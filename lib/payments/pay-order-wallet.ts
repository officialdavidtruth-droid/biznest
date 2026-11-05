import "server-only";
import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { decrementStockForOrder } from "@/lib/payments/stock";
import { emitWebhookEvent } from "@/lib/webhooks/dispatch";
import { notifyStoreOwnerOfPaidOrder, notifyCustomerOfPaidOrder } from "@/lib/notifications/notify";
import { postOrderSaleToLedger } from "@/lib/financial/order-ledger";
import { settleAndPayout } from "@/lib/payments/payout";
import { logError } from "@/lib/observability/log";
import { getOrderPayableNaira } from "@/lib/payments/order-payable";

export type WalletOrderPayment =
  | { ok: true; alreadyPaid: boolean }
  | { ok: false; code: "NOT_FOUND" | "NOT_PAYABLE" | "CURRENCY" | "INSUFFICIENT_FUNDS" | "WALLET_UNAVAILABLE" | "BUSY"; message: string };

export const walletOrderReference = (orderId: string) => `WALPAY-${orderId}`;

const fail = (code: Exclude<WalletOrderPayment, { ok: true }>["code"], message: string): WalletOrderPayment => ({ ok: false, code, message });

/**
 * Pays a shop order from the buyer's store wallet.
 *
 * One Serializable transaction moves everything that must agree: the order goes
 * PAID, the wallet is debited (guarded, so it can never go negative), a SUCCESSFUL
 * WALLET Payment and the wallet ledger line are written, and stock is taken. Any
 * card/transfer attempt still open for the order is closed so it can't be paid twice.
 *
 * The money already sits in the platform account (the customer topped up through
 * BizNest), so afterwards the vendor is paid out through the normal payout queue.
 */
export async function payOrderFromWallet(input: { orderId: string; userId: string }): Promise<WalletOrderPayment> {
  const order = await prisma.order.findFirst({
    where: { id: input.orderId, buyerId: input.userId },
    select: { id: true, storeId: true, total: true, currency: true, status: true, paymentProvider: true, paymentProofUrl: true },
  });
  if (!order) return fail("NOT_FOUND", "Order not found.");
  const reference = walletOrderReference(order.id);

  if (order.status !== "PENDING_PAYMENT" && order.status !== "CANCELLED") {
    const paid = await prisma.payment.findUnique({ where: { reference }, select: { status: true } });
    if (paid?.status === "SUCCESSFUL") return { ok: true, alreadyPaid: true };
    return fail("NOT_PAYABLE", "This order can't be paid any more.");
  }
  // A bank transfer the customer already has proof for is the vendor's to confirm; paying twice would double-charge them.
  if (order.paymentProvider === "CASH" && order.paymentProofUrl) return fail("NOT_PAYABLE", "You've already sent proof of a bank transfer for this order. Wait for the store to confirm it.");
  // Wallets hold naira only.
  if (String(order.currency ?? "NGN").toUpperCase() !== "NGN") return fail("CURRENCY", "Wallets hold naira only. Pay this order another way.");

  const amount = await getOrderPayableNaira(order.id, order.total);
  if (!(amount > 0)) return fail("NOT_PAYABLE", "Nothing is left to pay on this order.");

  try {
    const result = await prisma.$transaction(
      async (tx) => {
        const wallet = await tx.storeWallet.findUnique({ where: { storeId_userId: { storeId: order.storeId, userId: input.userId } } });
        if (!wallet || wallet.status !== "ACTIVE") throw new Error("WALLET_UNAVAILABLE");

        const already = await tx.payment.findUnique({ where: { reference }, select: { status: true } });
        if (already?.status === "SUCCESSFUL") return "already" as const;

        // A system-cancelled order may be revived, but only if no other payment ever completed on it.
        const settledElsewhere = await tx.payment.count({ where: { orderId: order.id, purpose: "ORDER", status: { in: ["SUCCESSFUL", "REFUND_PENDING", "REFUNDED"] } } });
        if (settledElsewhere > 0) throw new Error("NOT_PAYABLE");

        const claimed = await tx.order.updateMany({
          where: { id: order.id, buyerId: input.userId, status: { in: ["PENDING_PAYMENT", "CANCELLED"] } },
          data: { status: "PAID", paymentProvider: "WALLET", paymentReference: reference, checkoutUrl: null },
        });
        if (claimed.count === 0) throw new Error("NOT_PAYABLE");

        const debited = await tx.storeWallet.updateMany({ where: { id: wallet.id, status: "ACTIVE", balance: { gte: amount } }, data: { balance: { decrement: amount } } });
        if (debited.count === 0) throw new Error("INSUFFICIENT_FUNDS");
        const after = await tx.storeWallet.findUniqueOrThrow({ where: { id: wallet.id }, select: { balance: true } });

        // Close any card / bank-transfer attempt still open for this order.
        await tx.payment.updateMany({ where: { orderId: order.id, purpose: "ORDER", status: "PENDING", NOT: { reference } }, data: { status: "FAILED" } });

        const payment = await tx.payment.create({
          data: { storeId: order.storeId, walletId: wallet.id, orderId: order.id, purpose: "ORDER", provider: "WALLET", reference, status: "SUCCESSFUL", amount, currency: "NGN", verifiedAt: new Date() },
        });
        await tx.walletTransaction.create({
          data: { walletId: wallet.id, type: "PAYMENT", amount: -amount, balanceAfter: after.balance, reference: `TXN-${reference}`, paymentId: payment.id, orderId: order.id, note: `Payment for order ${order.id.slice(-8).toUpperCase()}` },
        });
        await decrementStockForOrder(tx, order.id, { allowOversell: true });
        return "paid" as const;
      },
      { isolationLevel: "Serializable" }
    );

    if (result === "already") return { ok: true, alreadyPaid: true };
  } catch (error) {
    const message = error instanceof Error ? error.message : "";
    if (message === "INSUFFICIENT_FUNDS") return fail("INSUFFICIENT_FUNDS", "Your wallet balance is too low for this order. Fund your wallet or pay another way.");
    if (message === "WALLET_UNAVAILABLE") return fail("WALLET_UNAVAILABLE", "Your wallet is currently unavailable.");
    if (message === "NOT_PAYABLE") return fail("NOT_PAYABLE", "This order can't be paid any more.");
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2034") return fail("BUSY", "That took too long. Please try again; you have not been charged.");
    throw error;
  }

  // Paid. Everything below is bookkeeping and must not undo the payment.
  try {
    await emitWebhookEvent("PAYMENT_SUCCESS", order.storeId, { orderId: order.id, reference, provider: "WALLET", amount, orderTotal: Number(order.total), currency: "NGN" });
    await emitWebhookEvent("ORDER_PAID", order.storeId, { orderId: order.id, status: "PAID" });
    await postOrderSaleToLedger(order.id);
    await settleAndPayout(reference);
  } catch (error) {
    void logError("PAYMENTS", "Wallet order paid but follow-up steps failed", { orderId: order.id, message: error instanceof Error ? error.message : String(error) });
  }
  await Promise.allSettled([
    notifyStoreOwnerOfPaidOrder(order.storeId, order.id, Number(order.total), order.currency),
    notifyCustomerOfPaidOrder(order.id),
  ]);
  return { ok: true, alreadyPaid: false };
}
