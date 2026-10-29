import "server-only";
import { prisma } from "@/lib/prisma";
import { decrementStockForOrder } from "@/lib/payments/stock";
import { emitWebhookEvent } from "@/lib/webhooks/dispatch";
import { notifyStoreOwnerOfPaidOrder, notifyCustomerOfPaidOrder } from "@/lib/notifications/notify";
import { postOrderSaleToLedger } from "@/lib/financial/order-ledger";
import { getOrderPayableNaira } from "@/lib/payments/order-payable";

export type SettlePrepaidOutcome = "paid" | "already_paid" | "not_found" | "balance_due";

/**
 * Marks a quote order PAID when its deposit already covers the whole total
 * (nothing left to charge). The money was collected and paid out when the
 * deposit settled, so no payment or payout is created here.
 * Idempotent: the PENDING_PAYMENT/CANCELLED -> PAID claim is a single updateMany.
 * Lives outside "use server" files on purpose; import only from server code.
 */
export async function settlePrepaidQuoteOrder(orderId: string): Promise<{ outcome: SettlePrepaidOutcome }> {
  const order = await prisma.order.findUnique({ where: { id: orderId } });
  if (!order) return { outcome: "not_found" };
  if (order.status !== "PENDING_PAYMENT" && order.status !== "CANCELLED") return { outcome: "already_paid" };

  const quote = await prisma.quote.findUnique({
    where: { orderId },
    select: { depositPayment: { select: { reference: true, status: true } } },
  });
  if (!quote?.depositPayment || quote.depositPayment.status !== "SUCCESSFUL") return { outcome: "balance_due" };
  if ((await getOrderPayableNaira(order.id, order.total)) > 0) return { outcome: "balance_due" };

  const claimed = await prisma.$transaction(async (tx) => {
    const result = await tx.order.updateMany({
      where: { id: order.id, status: { in: ["PENDING_PAYMENT", "CANCELLED"] } },
      data: { status: "PAID", paymentReference: quote.depositPayment!.reference },
    });
    if (result.count === 0) return result;
    await tx.orderStatusEvent.create({ data: { orderId: order.id, status: "PAID", note: "Fully covered by quote deposit" } });
    await decrementStockForOrder(tx, order.id, { allowOversell: true });
    return result;
  });
  if (claimed.count === 0) return { outcome: "already_paid" };

  await emitWebhookEvent("ORDER_PAID", order.storeId, { orderId: order.id, status: "PAID" });
  await postOrderSaleToLedger(order.id);
  await Promise.allSettled([
    notifyStoreOwnerOfPaidOrder(order.storeId, order.id, Number(order.total), order.currency),
    notifyCustomerOfPaidOrder(order.id),
  ]);
  return { outcome: "paid" };
}
