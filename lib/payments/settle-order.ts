import "server-only";
import { settleAndPayout } from "@/lib/payments/payout";
import { prisma } from "@/lib/prisma";
import { decrementStockForOrder } from "@/lib/payments/stock";
import { emitWebhookEvent } from "@/lib/webhooks/dispatch";
import { notifyStoreOwnerOfPaidOrder, notifyCustomerOfPaidOrder } from "@/lib/notifications/notify";
import { flagPaymentForReview } from "@/lib/payments/review";

export type SettleOrderOutcome = "paid" | "already_paid" | "not_found" | "wrong_provider" | "mismatch" | "blocked";

/**
 * Single settlement path for order payments, shared by both gateways' webhook
 * and browser callback so they can never disagree.
 *
 *  - Verified amount/currency must match the order, otherwise the payment is
 *    flagged for review (never silently dropped, never cancelled).
 *  - A system-cancelled order (PENDING_PAYMENT -> CANCELLED by an earlier
 *    callback / abandoned-checkout job) is revived when a verified payment
 *    arrives late. Orders whose Payment is already SUCCESSFUL/REFUNDED are not.
 *  - A stock shortfall never rolls the PAID transition back (oversell is
 *    flagged inside decrementStockForOrder).
 */
export async function settleOrderPayment(input: {
  orderId: string;
  reference: string;
  provider: "PAYSTACK" | "FLUTTERWAVE";
  verifiedAmountNaira: number;
  verifiedCurrency?: string | null;
  payload: object;
}): Promise<{ outcome: SettleOrderOutcome }> {
  const { orderId, reference, provider, verifiedAmountNaira, verifiedCurrency, payload } = input;

  const order = await prisma.order.findUnique({ where: { id: orderId } });
  if (!order) {
    await flagPaymentForReview(reference, "verified payment but order not found", payload);
    return { outcome: "not_found" };
  }
  if (order.paymentProvider !== provider) {
    await flagPaymentForReview(reference, `provider mismatch (order=${order.paymentProvider}, paid via ${provider})`, payload);
    return { outcome: "wrong_provider" };
  }
  if (Math.abs(verifiedAmountNaira - Number(order.total)) >= 0.01) {
    await flagPaymentForReview(reference, `amount mismatch (paid ${verifiedAmountNaira}, order total ${Number(order.total)})`, payload);
    return { outcome: "mismatch" };
  }
  if (verifiedCurrency && order.currency && verifiedCurrency.toUpperCase() !== order.currency.toUpperCase()) {
    await flagPaymentForReview(reference, `currency mismatch (paid ${verifiedCurrency}, order ${order.currency})`, payload);
    return { outcome: "mismatch" };
  }

  if (order.status !== "PENDING_PAYMENT" && order.status !== "CANCELLED") return { outcome: "already_paid" };

  if (order.status === "CANCELLED") {
    const payment = await prisma.payment.findUnique({ where: { reference }, select: { status: true } });
    if (!payment || (payment.status !== "PENDING" && payment.status !== "FAILED")) return { outcome: "blocked" };
  }

  const updated = await prisma.$transaction(async (tx) => {
    const result = await tx.order.updateMany({
      where: { id: orderId, status: { in: ["PENDING_PAYMENT", "CANCELLED"] } },
      data: { status: "PAID", paymentReference: reference },
    });
    await tx.payment.updateMany({
      where: { reference, status: { in: ["PENDING", "FAILED"] } },
      data: { status: "SUCCESSFUL", rawPayload: payload, verifiedAt: new Date() },
    });
    if (result.count > 0) await decrementStockForOrder(tx, orderId, { allowOversell: true });
    return result;
  });

  if (updated.count === 0) return { outcome: "already_paid" };

  await emitWebhookEvent("PAYMENT_SUCCESS", order.storeId, {
    orderId: order.id,
    reference,
    provider,
    amount: Number(order.total),
    currency: order.currency,
  });
  await emitWebhookEvent("ORDER_PAID", order.storeId, { orderId: order.id, status: "PAID" });
  void notifyStoreOwnerOfPaidOrder(order.storeId, order.id, Number(order.total), order.currency);
  void notifyCustomerOfPaidOrder(order.id);
  // Send the store its money. Awaited (it never throws) so the transfer is
  // attempted before this serverless invocation ends; the payouts cron retries
  // anything that has to wait, e.g. for the payment to settle into the balance.
  await settleAndPayout(reference);
  return { outcome: "paid" };
}
