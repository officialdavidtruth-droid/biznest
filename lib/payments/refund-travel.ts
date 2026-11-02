import "server-only";
import type { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { refundPayment } from "@/lib/payments/gateway";
import { secretKeyForPayment } from "@/lib/payments/store-gateway";
import { logActivity } from "@/lib/activity-log";
import { emitWebhookEvent } from "@/lib/webhooks/dispatch";
import { logWarn } from "@/lib/observability/log";
import { checkRefundAmount, payoutShareOfRefund } from "@/lib/travel";
import { sendTravelRefundEmail } from "@/lib/payments/travel-confirmation";
import type { ActionResult } from "@/types/actions";

/**
 * BizNest Travel refunds (full or partial, one per payment).
 *
 * Like settle-travel.ts this lives outside "use server" files because it takes a caller-supplied amount:
 * only the authorised dashboard action (lib/actions/travel.ts) and the staff reconciliation may call it.
 *
 *  - Online payments (a gateway Payment row shares the TravelPayment's reference): the refund goes back through
 *    the gateway that took the money. The gateway Payment is claimed (SUCCESSFUL -> REFUND_PENDING) BEFORE the
 *    gateway is called, so two clicks or two staff members can never trigger two refunds.
 *  - Everything else (cash, bank transfer, POS, manual entries): BizNest records the refund but moves no money;
 *    the agency pays the traveller back itself. The result says which happened.
 *
 * Partial refunds keep the TravelPayment RECEIVED with refundedAmount set, so the retained part (e.g. a
 * cancellation fee) still counts as paid. A full refund moves it to REFUNDED.
 */

const SETTLEMENT_LIKELY_DAYS = 3; // same conservative buffer as lib/actions/refund.ts

/**
 * Keeps vendor payouts consistent with a refund of `refund` out of the payment's `paymentAmount`.
 * Call inside the transaction that marks the payment refunded. Returns true when the payment has a Payout.
 *  - Payout not sent yet (QUEUED / HELD): cancelled on a full refund, reduced pro rata on a partial one.
 *  - Payout already sent (PAID / PROCESSING): the platform fronted the refund, so the refunded share of the
 *    payout is recorded as a clawback owed by the store.
 *  - FAILED / REVERSED: the store never got the money, nothing is owed.
 */
export async function recordTravelPayoutRefundEffect(tx: Prisma.TransactionClient, paymentId: string, paymentAmount: number, refund: number): Promise<boolean> {
  const payout = await tx.payout.findUnique({ where: { paymentId }, select: { id: true, storeId: true, status: true, amount: true } });
  if (!payout) return false;
  const payoutAmount = Number(payout.amount);
  const share = payoutShareOfRefund(payoutAmount, paymentAmount, refund);
  const full = refund >= paymentAmount - 0.005;

  let status = payout.status;
  if (status === "QUEUED" || status === "HELD") {
    const res = full
      ? await tx.payout.updateMany({ where: { id: payout.id, status: { in: ["QUEUED", "HELD"] } }, data: { status: "FAILED", lastError: "Payment was refunded before this payout was sent. Not owed.", nextAttemptAt: null } })
      : await tx.payout.updateMany({ where: { id: payout.id, status: { in: ["QUEUED", "HELD"] }, amount: { gte: share } }, data: { amount: { decrement: share } } });
    if (res.count === 1) return true;
    // A sender claimed it a moment ago: re-read and treat it as sent.
    status = (await tx.payout.findUnique({ where: { id: payout.id }, select: { status: true } }))?.status ?? status;
  }

  if ((status === "PAID" || status === "PROCESSING") && share > 0) {
    await tx.storeRefundClawback.create({
      data: { storeId: payout.storeId, paymentId, amount: share, reason: `Travel payment ${full ? "fully" : "partly"} refunded after the payout was ${status === "PAID" ? "paid" : "sent"}. Platform fronted this refund.` },
    });
    await tx.store.update({ where: { id: payout.storeId }, data: { refundClawbackOwed: { increment: share } } });
  }
  return true;
}

/** Legacy split-subaccount payments (no Payout row): clawback the merchant's share if it has likely settled already. */
async function recordLegacyClawbackIfSettled(
  tx: Prisma.TransactionClient,
  storeId: string,
  payment: { id: string; provider: string; splitSubaccountCode: string | null; verifiedAt: Date | null },
  paymentAmount: number,
  refund: number
) {
  if (payment.provider !== "PAYSTACK" || !payment.splitSubaccountCode || !payment.verifiedAt) return;
  if (Date.now() - payment.verifiedAt.getTime() <= SETTLEMENT_LIKELY_DAYS * 86_400_000) return;
  // Subscription is the plan, not a per-store row: reach it through the store's plan.
  const store = await tx.store.findUnique({ where: { id: storeId }, select: { subscription: { select: { commissionRate: true } } } }).catch(() => null);
  const rate = Number(store?.subscription?.commissionRate ?? 8);
  const merchantShare = Math.round(refund * (100 - rate)) / 100;
  if (!(merchantShare > 0) || !(paymentAmount > 0)) return;
  await tx.storeRefundClawback.create({ data: { storeId, paymentId: payment.id, amount: merchantShare, reason: "Merchant share already settled before this travel refund. Platform fronted it." } });
  await tx.store.update({ where: { id: storeId }, data: { refundClawbackOwed: { increment: merchantShare } } });
}

export async function refundTravelPayment(input: {
  store: { id: string; slug: string };
  actorEmail: string;
  tripId: string;
  travelPaymentId: string;
  amount: number;
  reason: string;
}): Promise<ActionResult<{ mode: "gateway" | "recorded"; amount: number; full: boolean }>> {
  const reason = String(input.reason ?? "").trim().slice(0, 300);
  if (reason.length < 3) return { success: false, error: "A reason is required for the refund record." };

  // storeId on the trip is the tenant-isolation check.
  const tp = await prisma.travelPayment.findFirst({ where: { id: input.travelPaymentId, tripId: input.tripId, trip: { storeId: input.store.id } } });
  if (!tp) return { success: false, error: "Payment not found." };
  const check = checkRefundAmount(tp, input.amount);
  if (!check.ok) return { success: false, error: check.error };
  const { amount, full } = check;

  const gateway = tp.reference
    ? await prisma.payment.findFirst({ where: { reference: tp.reference, storeId: input.store.id, travelTripId: input.tripId, purpose: "TRAVEL_BOOKING" } })
    : null;
  const onlineProvider = gateway && (gateway.provider === "PAYSTACK" || gateway.provider === "FLUTTERWAVE" || gateway.provider === "KORAPAY");

  const finishTravelPayment = (tx: Prisma.TransactionClient, refundReference: string) =>
    tx.travelPayment.updateMany({
      where: { id: tp.id, status: "RECEIVED", refundedAmount: 0 },
      data: { ...(full ? { status: "REFUNDED" } : {}), refundedAmount: amount, refundedAt: new Date(), refundReference, refundReason: reason, refundedByEmail: input.actorEmail },
    });

  let mode: "gateway" | "recorded";

  if (!onlineProvider) {
    // Manual money: record it. A bank-transfer Payment row (provider CASH) is kept in step so reports agree.
    mode = "recorded";
    try {
      await prisma.$transaction(async (tx) => {
        const res = await finishTravelPayment(tx, `MANUAL-${tp.id}`);
        if (res.count === 0) throw new Error("ALREADY");
        if (gateway && gateway.status === "SUCCESSFUL") {
          await tx.payment.updateMany({
            where: { id: gateway.id, status: "SUCCESSFUL" },
            data: { status: "REFUNDED", refundReference: `TRAVEL-REFUND-${gateway.id}`, refundedAmount: amount, refundReason: reason, refundedByEmail: input.actorEmail, refundedAt: new Date() },
          });
        }
      });
    } catch {
      return { success: false, error: "This payment was already refunded by another request." };
    }
  } else {
    mode = "gateway";
    if (gateway.status === "REFUND_PENDING") return { success: false, error: "This payment is already being refunded. A BizNest admin can reconcile it." };
    if (gateway.status !== "SUCCESSFUL") return { success: false, error: "The online payment behind this record is not in a refundable state." };

    // Flutterwave refunds by its own numeric transaction id, saved in the verification payload at settlement.
    let gatewayTransactionRef = gateway.reference;
    if (gateway.provider === "FLUTTERWAVE") {
      const rawId = (gateway.rawPayload as { data?: { id?: number } } | null)?.data?.id;
      if (!rawId) return { success: false, error: "Missing Flutterwave transaction id on this payment. It can't be refunded from here." };
      gatewayTransactionRef = String(rawId);
    }

    // Idempotency boundary: claim BEFORE calling the gateway. The intended amount is stored so reconciliation can match it.
    const claimed = await prisma.payment.updateMany({
      where: { id: gateway.id, status: "SUCCESSFUL" },
      data: { status: "REFUND_PENDING", refundedAmount: amount, refundReason: reason, refundedByEmail: input.actorEmail },
    });
    if (!claimed.count) return { success: false, error: "This payment is already being refunded or was refunded by another request." };

    const refund = await refundPayment({ provider: gateway.provider, gatewayTransactionRef, amountNaira: amount, secretKey: await secretKeyForPayment(gateway) });
    if (!refund.success) {
      await prisma.payment.updateMany({ where: { id: gateway.id, status: "REFUND_PENDING" }, data: { status: "SUCCESSFUL", refundedAmount: null, refundReason: null, refundedByEmail: null } });
      return { success: false, error: refund.error };
    }

    try {
      await prisma.$transaction(async (tx) => {
        const res = await tx.payment.updateMany({
          where: { id: gateway.id, status: "REFUND_PENDING" },
          data: { status: "REFUNDED", refundReference: refund.refundReference, refundedAmount: amount, refundedAt: new Date() },
        });
        if (!res.count) throw new Error("REFUND_CLAIM_LOST");
        const done = await finishTravelPayment(tx, refund.refundReference);
        if (!done.count) throw new Error("TRAVEL_PAYMENT_CHANGED");
        const hadPayout = await recordTravelPayoutRefundEffect(tx, gateway.id, Number(gateway.amount), amount);
        if (!hadPayout) await recordLegacyClawbackIfSettled(tx, input.store.id, gateway, Number(gateway.amount), amount);
      });
    } catch {
      void logWarn("PAYMENTS", "Travel refund accepted by the gateway but not fully recorded. Payment left as refund-pending for reconciliation.", { paymentId: gateway.id, tripId: input.tripId });
      return { success: false, error: "The gateway accepted the refund, but BizNest could not finish recording it. The payment is locked as refund-pending to prevent a duplicate refund. Ask a BizNest admin to reconcile it before retrying." };
    }
  }

  await logActivity({ storeId: input.store.id, action: "travel.payment_refunded", target: tp.id, metadata: { tripId: input.tripId, amount, full, mode, reason: reason.slice(0, 200) } });
  await emitWebhookEvent("PAYMENT_REFUNDED", input.store.id, { travelTripId: input.tripId, travelPaymentId: tp.id, amount, currency: gateway?.currency ?? "NGN", reason });
  // Awaited: un-awaited sends are dropped when the serverless invocation returns. Never throws.
  await sendTravelRefundEmail(input.tripId, amount, full, mode);

  return { success: true, data: { mode, amount, full } };
}
