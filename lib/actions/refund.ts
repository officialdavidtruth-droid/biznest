"use server";

import { prisma } from "@/lib/prisma";
import { refundPayment } from "@/lib/payments/gateway";
import { listPaystackRefundsForTransaction } from "@/lib/payments/paystack";
import { listFlutterwaveRefundsForTransaction } from "@/lib/payments/flutterwave";
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
 * Restores inventory for a fully refunded order exactly once.
 *
 * The RETURN movements are linked back to the order. That link is the
 * idempotency boundary: a replay of the refund (or a webhook/reconciliation
 * retry) sees the existing RETURN movement and does not add stock again.
 * This runs inside the same transaction as the payment/order refund state.
 */
async function restoreInventoryForRefund(
  tx: Prisma.TransactionClient,
  orderId: string,
  storeId: string,
) {
  const existingReturn = await tx.stockMovement.findFirst({
    where: { orderId, storeId, type: "RETURN" },
    select: { id: true },
  });
  if (existingReturn) return false;

  const order = await tx.order.findUnique({
    where: { id: orderId },
    include: { items: true },
  });
  if (!order) throw new Error("ORDER_NOT_FOUND");

  for (const item of order.items) {
    if (item.variantId) {
      const variant = await tx.productVariant.findUnique({
        where: { id: item.variantId },
      });
      if (!variant) continue;

      const nextQuantity = variant.quantity + item.quantity;
      await tx.productVariant.update({
        where: { id: variant.id },
        data: {
          quantity: nextQuantity,
          autoUnpublished: false,
        },
      });
      await tx.stockMovement.create({
        data: {
          variantId: variant.id,
          storeId,
          orderId,
          type: "RETURN",
          quantityChange: item.quantity,
          quantityAfter: nextQuantity,
          note: `Refund return (order ${orderId})`,
        },
      });
    } else if (item.productId) {
      const inventory = await tx.inventoryItem.findUnique({
        where: { productId: item.productId },
      });
      if (!inventory) continue;

      const wasAutoUnpublished = inventory.autoUnpublished;
      const nextQuantity = inventory.quantity + item.quantity;
      await tx.inventoryItem.update({
        where: { id: inventory.id },
        data: {
          quantity: nextQuantity,
          autoUnpublished: wasAutoUnpublished ? false : inventory.autoUnpublished,
        },
      });
      await tx.stockMovement.create({
        data: {
          inventoryItemId: inventory.id,
          storeId,
          orderId,
          type: "RETURN",
          quantityChange: item.quantity,
          quantityAfter: nextQuantity,
          note: `Refund return (order ${orderId})`,
        },
      });
      // A refund restores stock, but do not silently override a merchant's
      // publication decision. Only republish when the product was actually
      // unpublished because this inventory item hit zero.
      if (!inventory.quantity && wasAutoUnpublished) {
        await tx.product.update({
          where: { id: item.productId },
          data: { isPublished: true },
        });
      }
    }
  }

  return true;
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

      await restoreInventoryForRefund(tx, order.id, access.store.id);

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

  // Claim BEFORE calling the gateway. This is the idempotency boundary: a
  // concurrent request cannot reach Paystack/Flutterwave once another request
  // has claimed this payment.
  const claimed = await prisma.payment.updateMany({
    where: { id: payment.id, status: "SUCCESSFUL" },
    data: { status: "REFUND_PENDING", refundReason: reason.trim(), refundedByEmail: access.actorEmail },
  });
  if (!claimed.count) return { success: false, error: "This payment is already being refunded or was refunded by another request." };

  const refund = await refundPayment({ provider: payment.provider, gatewayTransactionRef, amountNaira: Number(payment.amount) });
  if (!refund.success) {
    await prisma.payment.updateMany({ where: { id: payment.id, status: "REFUND_PENDING" }, data: { status: "SUCCESSFUL", refundReason: null, refundedByEmail: null } });
    return { success: false, error: refund.error };
  }

  try {
    await prisma.$transaction(async (tx) => {
      const result = await tx.payment.updateMany({
        where: { id: payment.id, status: "REFUND_PENDING" },
        data: { status: "REFUNDED", refundReference: refund.refundReference, refundedAmount: payment.amount, refundedAt: new Date() },
      });
      if (!result.count) throw new Error("REFUND_CLAIM_LOST");
      await tx.order.update({ where: { id: order.id }, data: { status: "REFUNDED" } });
      await tx.orderStatusEvent.create({ data: { orderId: order.id, status: "REFUNDED", note: reason.trim() } });
      await restoreInventoryForRefund(tx, order.id, access.store.id);
      await recordRefundClawbackIfSettled(tx, access.store, payment);
    });
  } catch {
    return { success: false, error: "The gateway refund was accepted, but BizNest could not finish recording it. The payment is locked as refund-pending to prevent a duplicate refund; reconcile this payment before retrying." };
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

/** Reconciles a REFUND_PENDING payment by reading the gateway only. */
export async function reconcileRefundPendingPayment(slug: string, paymentId: string): Promise<ActionResult<{ status: "REFUNDED" | "FAILED" | "STILL_PENDING" }>> {
  const staff = await assertStaffAccess();
  if (!staff.success) return { success: false, error: staff.error };
  const store = await prisma.store.findUnique({ where: { slug }, include: { subscription: true } });
  if (!store) return { success: false, error: "Store not found." };
  const payment = await prisma.payment.findFirst({ where: { id: paymentId, storeId: store.id, status: "REFUND_PENDING" }, include: { order: true, booking: true, reservation: true } });
  if (!payment) return { success: false, error: "Refund-pending payment not found." };

  let gatewayStatus: "REFUNDED" | "FAILED" | "STILL_PENDING" = "STILL_PENDING";
  let refundReference: string | null = null;
  if (payment.provider === "PAYSTACK") {
    const result = await listPaystackRefundsForTransaction(payment.reference);
    if (!result.status) return { success: false, error: result.message || "Couldn't query Paystack refund status." };
    const refund = result.data.filter((r: any) => Number(r.amount ?? 0) === Math.round(Number(payment.amount) * 100)).sort((a: any, b: any) => new Date(b.createdAt ?? 0).getTime() - new Date(a.createdAt ?? 0).getTime())[0];
    if (refund) { refundReference = refund.id != null ? String(refund.id) : null; if (refund.status === "processed") gatewayStatus = "REFUNDED"; else if (refund.status === "failed") gatewayStatus = "FAILED"; }
  } else if (payment.provider === "FLUTTERWAVE") {
    const rawId = (payment.rawPayload as { data?: { id?: number } } | null)?.data?.id;
    if (!rawId) return { success: false, error: "Missing Flutterwave transaction id; cannot reconcile this refund safely." };
    const result = await listFlutterwaveRefundsForTransaction(String(rawId));
    if (result.status !== "success") return { success: false, error: result.message || "Couldn't query Flutterwave refund status." };
    const refund = result.data.filter((r: any) => Number(r.amount_refunded ?? r.amount ?? 0) === Number(payment.amount)).sort((a: any, b: any) => new Date(b.updatedAt ?? b.createdAt ?? 0).getTime() - new Date(a.updatedAt ?? a.createdAt ?? 0).getTime())[0];
    if (refund) { refundReference = refund.id != null ? String(refund.id) : null; const status = String(refund.status ?? "").toLowerCase(); if (status.startsWith("completed")) gatewayStatus = "REFUNDED"; else if (status === "failed") gatewayStatus = "FAILED"; }
  } else return { success: false, error: "This payment provider does not support gateway refund reconciliation." };

  if (gatewayStatus === "STILL_PENDING") return { success: true, data: { status: "STILL_PENDING" } };
  if (gatewayStatus === "FAILED") {
    const result = await prisma.payment.updateMany({ where: { id: payment.id, status: "REFUND_PENDING" }, data: { status: "SUCCESSFUL", refundReason: null, refundedByEmail: null } });
    if (!result.count) return { success: false, error: "Payment changed while reconciliation was running." };
    return { success: true, data: { status: "FAILED" } };
  }
  if (!refundReference) return { success: false, error: "Gateway reports a completed refund but did not return a refund reference; refusing to finalize without an auditable reference." };

  try {
    await prisma.$transaction(async (tx) => {
      const result = await tx.payment.updateMany({ where: { id: payment.id, status: "REFUND_PENDING" }, data: { status: "REFUNDED", refundReference, refundedAmount: payment.amount, refundedAt: new Date() } });
      if (!result.count) throw new Error("PAYMENT_CHANGED");
      if (payment.order) { await tx.order.update({ where: { id: payment.order.id }, data: { status: "REFUNDED" } }); await tx.orderStatusEvent.create({ data: { orderId: payment.order.id, status: "REFUNDED", note: payment.refundReason ?? "Refund reconciled from gateway" } }); await restoreInventoryForRefund(tx, payment.order.id, store.id); await recordRefundClawbackIfSettled(tx, store, payment); }
      if (payment.booking) await tx.booking.update({ where: { id: payment.booking.id }, data: { paymentStatus: "REFUNDED" } });
      if (payment.reservation) await tx.propertyReservation.update({ where: { id: payment.reservation.id }, data: { paymentStatus: "REFUNDED" } });
    });
  } catch { return { success: false, error: "The gateway confirms the refund, but BizNest could not finalize the local record. It remains refund-pending and is safe to reconcile again." }; }
  await emitWebhookEvent("PAYMENT_REFUNDED", store.id, { paymentId: payment.id, amount: Number(payment.amount), currency: payment.currency, reason: payment.refundReason ?? "Refund reconciled from gateway" });
  revalidatePath(`/store/${slug}/admin/payments`); revalidatePath(`/store/${slug}/admin/orders`); revalidatePath(`/store/${slug}/admin/bookings`); revalidatePath(`/store/${slug}/admin/pms`);
  return { success: true, data: { status: "REFUNDED" } };
}

export async function getRefundPendingPayments(slug: string) {
  const staff = await assertStaffAccess();
  if (!staff.success) return null;
  const store = await prisma.store.findUnique({ where: { slug }, select: { id: true } });
  if (!store) return null;
  const payments = await prisma.payment.findMany({ where: { storeId: store.id, status: "REFUND_PENDING" }, orderBy: { updatedAt: "asc" }, take: 50, select: { id: true, reference: true, provider: true, amount: true, currency: true, refundReason: true, updatedAt: true, orderId: true, bookingId: true, reservationId: true } });
  return payments.map((p) => ({ ...p, amount: Number(p.amount) }));
}

/**
 * Refunds a successful service Booking after the merchant has cancelled it.
 * Gateway refunds go back to the original payment method; wallet payments
 * are returned to the customer's store wallet. The Payment row is the
 * idempotency boundary, so a second request cannot record another refund.
 */
export async function issueBookingRefund(
  slug: string,
  bookingId: string,
  reason: string,
): Promise<ActionResult> {
  const access = await assertStoreAccess(slug);
  if (!access.success) return { success: false, error: access.error };
  const trimmedReason = reason.trim();
  if (!trimmedReason) return { success: false, error: "A reason is required for the refund record." };

  const booking = await prisma.booking.findFirst({
    where: { id: bookingId, storeId: access.store.id },
    include: { service: true, payments: true },
  });
  if (!booking) return { success: false, error: "Booking not found." };
  if (booking.status !== "CANCELLED") return { success: false, error: "Cancel the booking before issuing its refund." };
  if (booking.paymentStatus === "REFUNDED") return { success: false, error: "This booking has already been refunded." };
  if (booking.paymentStatus !== "PAID") return { success: false, error: "This booking has no successful payment to refund." };

  const payment = booking.payments.find((p) => p.purpose === "SERVICE_BOOKING" && p.status === "SUCCESSFUL");
  if (!payment) return { success: false, error: "No successful payment found for this booking." };

  if (payment.provider === "WALLET") {
    if (!payment.walletId) return { success: false, error: "This wallet payment has no wallet attached." };
    try {
      await prisma.$transaction(async (tx) => {
        const claimed = await tx.payment.updateMany({
          where: { id: payment.id, status: "SUCCESSFUL" },
          data: {
            status: "REFUNDED",
            refundReference: `WALLET-REFUND-${payment.id}`,
            refundedAmount: payment.amount,
            refundReason: trimmedReason,
            refundedByEmail: access.actorEmail,
            refundedAt: new Date(),
          },
        });
        if (!claimed.count) throw new Error("ALREADY_REFUNDED");
        const wallet = await tx.storeWallet.findUnique({ where: { id: payment.walletId } });
        if (!wallet) throw new Error("WALLET_NOT_FOUND");
        const updatedWallet = await tx.storeWallet.update({ where: { id: wallet.id }, data: { balance: { increment: payment.amount } } });
        await tx.walletTransaction.create({
          data: {
            walletId: wallet.id,
            type: "REFUND",
            amount: payment.amount,
            balanceAfter: updatedWallet.balance,
            reference: `REFUND-${payment.reference}`,
            paymentId: payment.id,
            bookingId: booking.id,
            note: `Refund for cancelled booking: ${trimmedReason}`,
          },
        });
        await tx.booking.update({ where: { id: booking.id }, data: { paymentStatus: "REFUNDED" } });
      }, { isolationLevel: "Serializable" });
    } catch (err) {
      const message = err instanceof Error ? err.message : "";
      if (message === "ALREADY_REFUNDED") return { success: false, error: "This payment was already refunded by another request." };
      return { success: false, error: "Couldn't return the wallet payment." };
    }
    await emitWebhookEvent("PAYMENT_REFUNDED", access.store.id, { bookingId: booking.id, paymentId: payment.id, amount: Number(payment.amount), currency: payment.currency, reason: trimmedReason });
    revalidatePath(`/store/${slug}/admin/bookings`);
    revalidatePath(`/store/${slug}/account/bookings`);
    return { success: true, data: undefined };
  }

  let gatewayTransactionRef = payment.reference;
  if (payment.provider === "FLUTTERWAVE") {
    const rawId = (payment.rawPayload as { data?: { id?: number } } | null)?.data?.id;
    if (!rawId) return { success: false, error: "Missing Flutterwave transaction id on this payment — can't issue a gateway refund." };
    gatewayTransactionRef = String(rawId);
  }
  const claimed = await prisma.payment.updateMany({ where: { id: payment.id, status: "SUCCESSFUL" }, data: { status: "REFUND_PENDING", refundReason: trimmedReason, refundedByEmail: access.actorEmail } });
  if (!claimed.count) return { success: false, error: "This payment is already being refunded or was refunded by another request." };

  const refund = await refundPayment({ provider: payment.provider, gatewayTransactionRef, amountNaira: Number(payment.amount) });
  if (!refund.success) {
    await prisma.payment.updateMany({ where: { id: payment.id, status: "REFUND_PENDING" }, data: { status: "SUCCESSFUL", refundReason: null, refundedByEmail: null } });
    return { success: false, error: refund.error };
  }
  try {
    await prisma.$transaction(async (tx) => {
      const result = await tx.payment.updateMany({ where: { id: payment.id, status: "REFUND_PENDING" }, data: { status: "REFUNDED", refundReference: refund.refundReference, refundedAmount: payment.amount, refundedAt: new Date() } });
      if (!result.count) throw new Error("REFUND_CLAIM_LOST");
      await tx.booking.update({ where: { id: booking.id }, data: { paymentStatus: "REFUNDED" } });
    });
  } catch {
    return { success: false, error: "The gateway refund was accepted, but BizNest could not finish recording it. The payment is locked as refund-pending to prevent a duplicate refund; reconcile this payment before retrying." };
  }
  await emitWebhookEvent("PAYMENT_REFUNDED", access.store.id, { bookingId: booking.id, paymentId: payment.id, amount: Number(payment.amount), currency: payment.currency, reason: trimmedReason });
  revalidatePath(`/store/${slug}/admin/bookings`);
  revalidatePath(`/store/${slug}/account/bookings`);
  return { success: true, data: undefined };
}

/** Refunds a paid PMS reservation after cancellation. */
export async function issueReservationRefund(
  slug: string,
  reservationId: string,
  reason: string,
): Promise<ActionResult> {
  const access = await assertStoreAccess(slug);
  if (!access.success) return { success: false, error: access.error };
  const trimmedReason = reason.trim();
  if (!trimmedReason) return { success: false, error: "A reason is required for the refund record." };

  const reservation = await prisma.propertyReservation.findFirst({
    where: { id: reservationId, storeId: access.store.id },
    include: { payments: true },
  });
  if (!reservation) return { success: false, error: "Reservation not found." };
  if (reservation.status !== "CANCELLED") return { success: false, error: "Cancel the reservation before issuing its refund." };
  if (reservation.paymentStatus === "REFUNDED") return { success: false, error: "This reservation has already been refunded." };
  if (reservation.paymentStatus !== "PAID") return { success: false, error: "This reservation has no successful payment to refund." };

  const payment = reservation.payments.find((p) => p.purpose === "PMS_RESERVATION" && p.status === "SUCCESSFUL");
  if (!payment) return { success: false, error: "No successful payment found for this reservation." };
  if (payment.provider !== "PAYSTACK" && payment.provider !== "FLUTTERWAVE") return { success: false, error: "This reservation payment cannot be refunded through the gateway." };

  let gatewayTransactionRef = payment.reference;
  if (payment.provider === "FLUTTERWAVE") {
    const rawId = (payment.rawPayload as { data?: { id?: number } } | null)?.data?.id;
    if (!rawId) return { success: false, error: "Missing Flutterwave transaction id on this payment — can't issue a gateway refund." };
    gatewayTransactionRef = String(rawId);
  }
  const claimed = await prisma.payment.updateMany({ where: { id: payment.id, status: "SUCCESSFUL" }, data: { status: "REFUND_PENDING", refundReason: trimmedReason, refundedByEmail: access.actorEmail } });
  if (!claimed.count) return { success: false, error: "This payment is already being refunded or was refunded by another request." };

  const refund = await refundPayment({ provider: payment.provider, gatewayTransactionRef, amountNaira: Number(payment.amount) });
  if (!refund.success) {
    await prisma.payment.updateMany({ where: { id: payment.id, status: "REFUND_PENDING" }, data: { status: "SUCCESSFUL", refundReason: null, refundedByEmail: null } });
    return { success: false, error: refund.error };
  }
  try {
    await prisma.$transaction(async (tx) => {
      const result = await tx.payment.updateMany({ where: { id: payment.id, status: "REFUND_PENDING" }, data: { status: "REFUNDED", refundReference: refund.refundReference, refundedAmount: payment.amount, refundedAt: new Date() } });
      if (!result.count) throw new Error("REFUND_CLAIM_LOST");
      await tx.propertyReservation.update({ where: { id: reservation.id }, data: { paymentStatus: "REFUNDED" } });
    });
  } catch {
    return { success: false, error: "The gateway refund was accepted, but BizNest could not finish recording it. The payment is locked as refund-pending to prevent a duplicate refund; reconcile this payment before retrying." };
  }
  await emitWebhookEvent("PAYMENT_REFUNDED", access.store.id, { reservationId: reservation.id, paymentId: payment.id, amount: Number(payment.amount), currency: payment.currency, reason: trimmedReason });
  revalidatePath(`/store/${slug}/admin/pms`);
  return { success: true, data: undefined };
}
