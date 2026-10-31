import "server-only";
import { amountCoversExpected } from "@/lib/payments/amount";
import { prisma } from "@/lib/prisma";
import { decrementStockForOrder } from "@/lib/payments/stock";
import { emitWebhookEvent } from "@/lib/webhooks/dispatch";
import { notifyStoreOwnerOfPaidOrder, notifyCustomerOfPaidOrder } from "@/lib/notifications/notify";
import { flagPaymentForReview } from "@/lib/payments/review";
import { postOrderSaleToLedger } from "@/lib/financial/order-ledger";
import { settleAndPayout } from "@/lib/payments/payout";
import { getOrderPayableNaira } from "@/lib/payments/order-payable";

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
  provider: "PAYSTACK" | "FLUTTERWAVE" | "KORAPAY";
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
  const payableNaira = await getOrderPayableNaira(order.id, order.total);
  if (!amountCoversExpected(verifiedAmountNaira, payableNaira)) {
    await flagPaymentForReview(reference, `amount mismatch (paid ${verifiedAmountNaira}, order payable ${payableNaira}, order total ${Number(order.total)})`, payload);
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
    // What the customer actually paid: the order total less any quote deposit already settled.
    amount: await getOrderPayableNaira(order.id, order.total),
    orderTotal: Number(order.total),
    currency: order.currency,
  });
  await emitWebhookEvent("ORDER_PAID", order.storeId, { orderId: order.id, status: "PAID" });
  await postOrderSaleToLedger(order.id);
  // Queue + send the vendor's payout. Every other settlement path (bookings,
  // invoices, quotes, reservations) already does this; orders were the only one
  // that did not, so card-paid store orders never reached the vendor's bank.
  // Idempotent (Payout.paymentId is unique) and never throws.
  await settleAndPayout(reference);
  // Awaited on purpose: an un-awaited `void` send is frozen/dropped once this
  // serverless invocation returns its redirect, so owners/customers were not notified.
  await Promise.allSettled([
    notifyStoreOwnerOfPaidOrder(order.storeId, order.id, Number(order.total), order.currency),
    notifyCustomerOfPaidOrder(order.id),
  ]);
  return { outcome: "paid" };
}
