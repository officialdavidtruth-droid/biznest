"use server";

import { prisma } from "@/lib/prisma";
import { refundPayment } from "@/lib/payments/gateway";
import { emitWebhookEvent } from "@/lib/webhooks/dispatch";
import { revalidatePath } from "next/cache";
import type { ActionResult } from "@/types/actions";
import type { Prisma } from "@prisma/client";
import { roundMoney } from "@/lib/utils/pricing";
import { assertStorePermission } from "@/lib/access/assert-store-access";
import { auth } from "@/lib/auth";

// Order statuses a refund can be issued from. PENDING_PAYMENT/CANCELLED
// never had money move; REFUNDED is already done; DISPUTED is left out
// deliberately — a disputed order should be resolved via the dispute flow
// first so there's a record of why, rather than refunded out from under it.
const REFUNDABLE_ORDER_STATUSES = ["PAID", "IN_PROGRESS", "DELIVERED", "COMPLETED"] as const;

// Paystack settles subaccount splits T+1, excluding weekends/holidays
// (confirmed via support, Aug 2026). There's no per-transaction "has this
// settled yet" API, so this is a deliberately conservative calendar-day
// buffer -- long enough to cover a weekend sitting inside the T+1 window.
// Below this age we assume the split may still be inside Paystack's
// balance and let their own "attempt to reverse splits" behavior (per the
// same support reply) handle it with no ledger entry from us. Above it, we
// assume the merchant's share already hit their bank account and record a
// clawback instead of guessing wrong in the platform's favor.
const SETTLEMENT_LIKELY_DAYS = 3;

// Manual refunds are reached from the order detail page ("orders"
// permission in dashboard-nav.ts), so a MANAGER/STAFF granted "orders"
// access can issue them too — not just the owner. Clawback settlement
// below (assertStaffAccess) stays platform-staff-only regardless, per its
// own comment.
async function assertStoreAccess(slug: string) {
  const access = await assertStorePermission(slug, "orders");
  if (!access.success) return access;

  const session = await auth();
  const withSubscription = await prisma.store.findUnique({
    where: { id: access.store.id },
    include: { subscription: true },
  });
  return {
    success: true as const,
    store: { ...access.store, subscription: withSubscription?.subscription ?? null },
    actorEmail: session?.user?.email ?? "unknown",
  };
}

/**
 * Records a clawback if this refund's payment was actually split to the
 * merchant's subaccount and had already settled to their bank account by
 * the time the refund was issued. Doesn't move any money itself -- same
 * "record what already happened" shape as issueRefund's Payment update.
 *
 * Whether a *specific* payment was split is read directly off
 * Payment.splitSubaccountCode, stamped at charge time by chargeCustomer's
 * result (see order.ts/invoice.ts/quote.ts) -- not inferred from the
 * store's *current* payout connection, which can drift if a store
 * disconnects/reconnects payouts between the charge and the refund.
 * Older payments created before this field existed will have it null and
 * are treated as unsplit here (pre-existing behavior for that backlog).
 */
async function recordRefundClawbackIfSettled(
  tx: Prisma.TransactionClient,
  store: { id: string; subscription: { commissionRate: unknown } | null },
  payment: { id: string; amount: unknown; verifiedAt: Date | null; provider: string; splitSubaccountCode: string | null }
) {
  if (payment.provider !== "PAYSTACK") return; // Flutterwave split-reversal behavior isn't confirmed the same way yet.
  if (!payment.splitSubaccountCode) return; // this charge wasn't split to a subaccount
  if (!payment.verifiedAt) return;

  const ageMs = Date.now() - payment.verifiedAt.getTime();
  const likelySettled = ageMs > SETTLEMENT_LIKELY_DAYS * 24 * 60 * 60 * 1000;
  if (!likelySettled) return;

  const commissionRate = Number(store.subscription?.commissionRate ?? 8);
  const merchantShare = roundMoney(Number(payment.amount) * (100 - commissionRate) / 100);
  if (merchantShare <= 0) return;

  await tx.storeRefundClawback.create({
    data: {
      storeId: store.id,
      paymentId: payment.id,
      amount: merchantShare,
      reason: `Merchant share already settled (payment verified ${payment.verifiedAt.toISOString()}) — platform fronted this refund.`,
    },
  });
  await tx.store.update({ where: { id: store.id }, data: { refundClawbackOwed: { increment: merchantShare } } });
}

/**
 * Manual "issue refund" action for support/admin use. Issues a full refund
 * against the order's successful Payment record through whichever gateway
 * actually processed the charge, then marks both the Payment and the Order
 * accordingly. There's no self-serve refund button for buyers or sellers —
 * this exists for support/admin to resolve disputes, cancellations, and
 * mistaken charges by hand.
 */
export async function issueRefund(
  slug: string,
  orderId: string,
  reason: string
): Promise<ActionResult> {
  const access = await assertStoreAccess(slug);
  if (!access.success) return { success: false, error: access.error };

  if (!reason.trim()) {
    return { success: false, error: "A reason is required for the refund record." };
  }

  const order = await prisma.order.findFirst({
    where: { id: orderId, storeId: access.store.id },
    include: { payments: true }, // Payment.splitSubaccountCode is a plain column, included by default
  });
  if (!order) return { success: false, error: "Order not found." };

  if (!REFUNDABLE_ORDER_STATUSES.includes(order.status as (typeof REFUNDABLE_ORDER_STATUSES)[number])) {
    return { success: false, error: `Orders in ${order.status.replace("_", " ").toLowerCase()} status can't be refunded from here.` };
  }

  const payment = order.payments.find((p) => p.purpose === "ORDER" && p.status === "SUCCESSFUL");
  if (!payment) {
    return { success: false, error: "No successful payment found for this order to refund." };
  }
  if (payment.status === "REFUNDED" || payment.refundedAt) {
    return { success: false, error: "This payment has already been refunded." };
  }

  // Cash/POS sales never touched an online gateway, so there's nothing to
  // call out to — just record the refund directly. A gateway refund
  // reference isn't meaningful here, so we use a synthetic one so the
  // unique refundReference column and the "already refunded" checks above
  // still work the same way as the online path.
  if (payment.provider === "CASH") {
    // Payment flip, order status, status-event log, and the commission
    // reversal all describe one thing happening (this sale got refunded) —
    // grouped so a crash partway through can't leave the payment marked
    // REFUNDED while the order or commission balance falls out of sync.
    let refunded: boolean;
    refunded = await prisma.$transaction(async (tx) => {
      const result = await tx.payment.updateMany({
        where: { id: payment.id, status: "SUCCESSFUL" },
        data: {
          status: "REFUNDED",
          refundReference: `CASH-${payment.id}`,
          refundedAmount: payment.amount,
          refundReason: reason.trim(),
          refundedByEmail: access.actorEmail,
          refundedAt: new Date(),
        },
      });
      if (result.count === 0) return false;

      await tx.order.update({ where: { id: order.id }, data: { status: "REFUNDED" } });
      await tx.orderStatusEvent.create({
        data: { orderId: order.id, status: "REFUNDED", note: `Cash/POS refund: ${reason.trim()}` },
      });

      // Reverse the commission accrued on this sale (see
      // Store.posCommissionOwed) so a refunded POS order doesn't leave
      // the store owing commission on money it never actually kept.
      // Floored at zero in case some of it was already settled — the
      // owner shouldn't end up with a negative balance from a single
      // refund; that gets reconciled the normal way instead.
      if (order.channel === "POS" && Number(order.commission) > 0) {
        const store = await tx.store.findUnique({ where: { id: access.store.id }, select: { posCommissionOwed: true } });
        const reduceBy = Math.min(Number(order.commission), Number(store?.posCommissionOwed ?? 0));
        if (reduceBy > 0) {
          await tx.store.update({ where: { id: access.store.id }, data: { posCommissionOwed: { decrement: reduceBy } } });
        }
      }

      return true;
    });

    if (!refunded) {
      return { success: false, error: "This payment was already refunded by another request." };
    }

    await emitWebhookEvent("PAYMENT_REFUNDED", access.store.id, {
      orderId: order.id,
      paymentId: payment.id,
      amount: Number(payment.amount),
      currency: payment.currency,
      reason: reason.trim(),
    });

    revalidatePath(`/store/${slug}/admin/orders/${orderId}`);
    revalidatePath(`/store/${slug}/admin/orders`);
    revalidatePath(`/store/${slug}/admin/payments`);

    return { success: true, data: undefined };
  }

  // Flutterwave's refund endpoint takes their own numeric transaction id,
  // not our tx_ref (Payment.reference) — pull it back out of the raw
  // verification payload saved when the charge was confirmed.
  let gatewayTransactionRef = payment.reference;
  if (payment.provider === "FLUTTERWAVE") {
    const rawId = (payment.rawPayload as { data?: { id?: number } } | null)?.data?.id;
    if (!rawId) {
      return { success: false, error: "Missing Flutterwave transaction id on this payment — can't issue a gateway refund." };
    }
    gatewayTransactionRef = String(rawId);
  }

  const refund = await refundPayment({
    provider: payment.provider,
    gatewayTransactionRef,
    amountNaira: Number(payment.amount),
  });
  if (!refund.success) {
    return { success: false, error: refund.error };
  }

  // Idempotency guard mirrors the webhook/callback pattern elsewhere:
  // only transition a payment that's still SUCCESSFUL, via updateMany's
  // affected-row count, so a double-click or concurrent request can't
  // record two refunds (and can't call the gateway twice either, since
  // the earlier findFirst/refundedAt check above already screens most of
  // that — this is the last-line atomic guard on the DB write itself).
  // Grouped with the clawback check in one transaction so a crash partway
  // through can't leave the payment marked REFUNDED while the clawback
  // ledger falls out of sync (same reasoning as the cash/POS branch above).
  let result: { count: number };
  try {
    result = await prisma.$transaction(async (tx) => {
      const updateResult = await tx.payment.updateMany({
        where: { id: payment.id, status: "SUCCESSFUL" },
        data: {
          status: "REFUNDED",
          refundReference: refund.refundReference,
          refundedAmount: payment.amount,
          refundReason: reason.trim(),
          refundedByEmail: access.actorEmail,
          refundedAt: new Date(),
        },
      });
      if (updateResult.count === 0) return updateResult;

      await tx.order.update({ where: { id: order.id }, data: { status: "REFUNDED" } });
      await tx.orderStatusEvent.create({ data: { orderId: order.id, status: "REFUNDED", note: reason.trim() } });
      await recordRefundClawbackIfSettled(tx, access.store, payment);

      return updateResult;
    });
  } catch {
    return { success: false, error: "The refund went through at the gateway, but recording it failed — check this order and contact support before retrying." };
  }
  if (result.count === 0) {
    return { success: false, error: "This payment was already refunded by another request." };
  }

  await emitWebhookEvent("PAYMENT_REFUNDED", access.store.id, {
    orderId: order.id,
    paymentId: payment.id,
    amount: Number(payment.amount),
    currency: payment.currency,
    reason: reason.trim(),
  });

  revalidatePath(`/store/${slug}/admin/orders/${orderId}`);
  revalidatePath(`/store/${slug}/admin/orders`);
  revalidatePath(`/store/${slug}/admin/payments`);

  return { success: true, data: undefined };
}

// --- Refund clawback ledger (see StoreRefundClawback / migration
// 20260828140000) -- what the platform is owed back because it fronted a
// merchant's already-settled share on a refund. Deliberately staff-only:
// this reflects money support/admin will need to actually go recover from
// the merchant (deduct from a future payout, bank transfer, etc), not
// something the merchant self-manages.

async function assertStaffAccess() {
  const session = await auth();
  if (!session?.user?.id) return { success: false as const, error: "You must be signed in." };
  if (session.user.role !== "PLATFORM_ADMIN" && session.user.role !== "SUPPORT_MODERATOR") {
    return { success: false as const, error: "Only platform staff can view or settle refund clawbacks." };
  }
  return { success: true as const, actorEmail: session.user.email ?? "unknown" };
}

export async function getRefundClawbackBalance(slug: string) {
  const staff = await assertStaffAccess();
  if (!staff.success) return null;

  const store = await prisma.store.findUnique({ where: { slug }, select: { id: true, refundClawbackOwed: true } });
  if (!store) return null;

  const [clawbacks, settlements] = await Promise.all([
    prisma.storeRefundClawback.findMany({ where: { storeId: store.id }, orderBy: { createdAt: "desc" }, take: 10 }),
    prisma.refundClawbackSettlement.findMany({ where: { storeId: store.id }, orderBy: { createdAt: "desc" }, take: 10 }),
  ]);

  return {
    owed: roundMoney(Number(store.refundClawbackOwed)),
    currency: "NGN",
    recentClawbacks: clawbacks.map((c) => ({ id: c.id, amount: Number(c.amount), reason: c.reason, createdAt: c.createdAt })),
    recentSettlements: settlements.map((s) => ({ id: s.id, amount: Number(s.amount), note: s.note, settledByEmail: s.settledByEmail, createdAt: s.createdAt })),
  };
}

/**
 * Records that some (or all) of the accrued refund-clawback balance has
 * been recovered from the merchant outside the app (deducted from a bank
 * transfer settlement, held back from a manual payout, etc) and clears it
 * from Store.refundClawbackOwed. Same "record what already happened"
 * shape, atomic guard, and reasoning as recordPosCommissionSettlement in
 * lib/actions/pos.ts — mirrored deliberately rather than sharing code,
 * since the two ledgers track opposite directions of obligation.
 */
export async function recordRefundClawbackSettlement(
  slug: string,
  amount: number,
  note?: string
): Promise<ActionResult<{ remainingOwed: number }>> {
  const staff = await assertStaffAccess();
  if (!staff.success) return { success: false, error: staff.error };

  const roundedAmount = roundMoney(amount);
  if (!Number.isFinite(roundedAmount) || roundedAmount <= 0) {
    return { success: false, error: "Enter a settlement amount greater than zero." };
  }

  const store = await prisma.store.findUnique({ where: { slug }, select: { id: true } });
  if (!store) return { success: false, error: "Store not found." };

  let remainingOwed: number;
  try {
    remainingOwed = await prisma.$transaction(async (tx) => {
      const result = await tx.store.updateMany({
        where: { id: store.id, refundClawbackOwed: { gte: roundedAmount } },
        data: { refundClawbackOwed: { decrement: roundedAmount } },
      });
      if (result.count === 0) {
        const current = await tx.store.findUnique({ where: { id: store.id }, select: { refundClawbackOwed: true } });
        throw new Error(`That's more than the ${Number(current?.refundClawbackOwed ?? 0).toLocaleString()} currently owed.`);
      }

      await tx.refundClawbackSettlement.create({
        data: { storeId: store.id, amount: roundedAmount, note: note?.trim() || null, settledByEmail: staff.actorEmail },
      });

      const updated = await tx.store.findUniqueOrThrow({ where: { id: store.id }, select: { refundClawbackOwed: true } });
      return Number(updated.refundClawbackOwed);
    });
  } catch (err) {
    return { success: false, error: err instanceof Error ? err.message : "Couldn't record this settlement." };
  }

  revalidatePath(`/store/${slug}/admin/payments`);
  return { success: true, data: { remainingOwed } };
}
