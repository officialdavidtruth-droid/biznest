import "server-only";
import { prisma } from "@/lib/prisma";
import { decrementStockForOrder } from "@/lib/payments/stock";
import { emitWebhookEvent } from "@/lib/webhooks/dispatch";
import { notifyStoreOwnerOfPaidOrder, notifyCustomerOfPaidOrder } from "@/lib/notifications/notify";
import { postOrderSaleToLedger } from "@/lib/financial/order-ledger";
import { getOrderPayableNaira } from "@/lib/payments/order-payable";

export type SettleManualOutcome = "paid" | "already_paid" | "not_found" | "not_manual";

/**
 * Settles an order the VENDOR confirmed they received by bank transfer.
 *
 * Same effects as settleOrderPayment (stock, webhooks, ledger, notifications)
 * minus gateway verification: the vendor's confirmation is the verification.
 * No payout is queued because the money never touched BizNest.
 * Idempotent: the PENDING_PAYMENT/CANCELLED -> PAID claim is a single updateMany.
 */
export async function settleManualOrderPayment(input: { orderId: string; storeId: string; confirmedByUserId?: string | null }): Promise<{ outcome: SettleManualOutcome }> {
  const order = await prisma.order.findFirst({ where: { id: input.orderId, storeId: input.storeId } });
  if (!order) return { outcome: "not_found" };
  if (order.paymentProvider !== "CASH") return { outcome: "not_manual" };
  if (order.status !== "PENDING_PAYMENT" && order.status !== "CANCELLED") return { outcome: "already_paid" };

  const reference = order.id;
  const claimed = await prisma.$transaction(async (tx) => {
    const result = await tx.order.updateMany({
      where: { id: order.id, status: { in: ["PENDING_PAYMENT", "CANCELLED"] } },
      data: { status: "PAID", paymentReference: reference, fulfillmentStatus: "NEW", kitchenStatus: "QUEUED" },
    });
    if (result.count === 0) return result;
    const paid = await tx.payment.updateMany({
      where: { reference, status: { in: ["PENDING", "FAILED"] } },
      data: {
        status: "SUCCESSFUL",
        verifiedAt: new Date(),
        rawPayload: { method: "BANK_TRANSFER", confirmedBy: input.confirmedByUserId ?? null, proofUrl: order.paymentProofUrl ?? null },
      },
    });
    if (paid.count === 0 && !(await tx.payment.findUnique({ where: { reference }, select: { id: true } }))) {
      // Order had no Payment row (older/edge data): create it so refunds and the ledger have one.
      await tx.payment.create({
        data: {
          storeId: order.storeId,
          orderId: order.id,
          purpose: "ORDER",
          provider: "CASH",
          reference,
          status: "SUCCESSFUL",
          amount: await getOrderPayableNaira(order.id, order.total),
          currency: order.currency,
          verifiedAt: new Date(),
          rawPayload: { method: "BANK_TRANSFER", confirmedBy: input.confirmedByUserId ?? null, proofUrl: order.paymentProofUrl ?? null },
        },
      });
    }
    await tx.orderStatusEvent.create({ data: { orderId: order.id, status: "PAID" } });
    await decrementStockForOrder(tx, order.id, { allowOversell: true });
    return result;
  });

  if (claimed.count === 0) return { outcome: "already_paid" };

  await emitWebhookEvent("PAYMENT_SUCCESS", order.storeId, {
    orderId: order.id,
    reference,
    provider: "BANK_TRANSFER",
    // What the customer actually paid: the order total less any quote deposit already settled.
    amount: await getOrderPayableNaira(order.id, order.total),
    orderTotal: Number(order.total),
    currency: order.currency,
  });
  await emitWebhookEvent("ORDER_PAID", order.storeId, { orderId: order.id, status: "PAID" });
  await postOrderSaleToLedger(order.id);
  await Promise.allSettled([
    notifyStoreOwnerOfPaidOrder(order.storeId, order.id, Number(order.total), order.currency),
    notifyCustomerOfPaidOrder(order.id),
  ]);
  return { outcome: "paid" };
}
