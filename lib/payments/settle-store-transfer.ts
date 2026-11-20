import "server-only";
import { prisma } from "@/lib/prisma";
import { settleAndPayout } from "@/lib/payments/payout";
import { settleOrderPayment } from "@/lib/payments/settle-order";
import { findMatchingIntent } from "@/lib/payments/transfer-intent";
import { logError } from "@/lib/observability/log";
import type { PaymentProvider } from "@prisma/client";

/**
 * A customer paid into a store's dedicated account number.
 *
 * Lives outside "use server" files on purpose (it takes gateway-verified amounts). Import it only from the
 * webhook route handlers, AFTER the transaction has been re-verified with the gateway.
 *
 * Records the transfer as a SUCCESSFUL Payment (purpose STORE_TRANSFER) and hands it to the normal payout
 * pipeline, so it follows the same hold/auto mode, gateway fee and retry rules as every other vendor payment.
 * Idempotent: the Payment reference is derived from the gateway's own transaction reference, so a webhook
 * retry never pays the vendor twice.
 */
export async function settleStoreTransfer(params: {
  provider: PaymentProvider;
  /** Which store account was paid: the number it was issued, or our reference for it. */
  accountNumber?: string | null;
  accountReference?: string | null;
  /** The gateway's own id/reference for this incoming transfer. */
  gatewayReference: string;
  verifiedAmountNaira: number;
  rawPayload: object;
}): Promise<{ ok: boolean; reason?: string }> {
  const account = await prisma.storeVirtualAccount.findFirst({
    where: {
      provider: params.provider,
      ...(params.accountReference ? { reference: params.accountReference } : { accountNumber: params.accountNumber ?? "__none__" }),
    },
    select: { id: true, storeId: true },
  });
  if (!account) return { ok: false, reason: "unknown account" };

  const amount = Number(params.verifiedAmountNaira);
  if (!Number.isFinite(amount) || amount <= 0) return { ok: false, reason: "no amount" };

  // A checkout order waiting on this exact amount? Then this transfer pays that order (the order's own payment
  // settles and pays the vendor out), instead of landing as a loose store transfer.
  const settled = await settleMatchedOrder(account.storeId, params.provider, params.gatewayReference, amount, params.rawPayload);
  if (settled) return { ok: true };

  const reference = `VAT-${params.provider.slice(0, 3)}-${params.gatewayReference}`.slice(0, 100);
  try {
    await prisma.payment.create({
      data: {
        storeId: account.storeId,
        purpose: "STORE_TRANSFER",
        provider: params.provider,
        reference,
        status: "SUCCESSFUL",
        amount,
        currency: "NGN",
        rawPayload: params.rawPayload as object,
        verifiedAt: new Date(),
      },
    });
  } catch (err) {
    // P2002: this transfer was already recorded (webhook retry). Fall through so a crash between the
    // insert and the payout still gets finished; settleAndPayout is idempotent.
    if (!(err && typeof err === "object" && (err as { code?: string }).code === "P2002")) {
      void logError("PAYMENTS", "Could not record a store transfer", { reference, error: String(err) });
      return { ok: false, reason: "could not record payment" };
    }
  }
  await settleAndPayout(reference);
  return { ok: true };
}

/** Returns true when the transfer paid a waiting checkout order (now or on an earlier delivery of the same webhook). */
async function settleMatchedOrder(storeId: string, provider: PaymentProvider, gatewayReference: string, amount: number, rawPayload: object): Promise<boolean> {
  try {
    const already = await prisma.storeTransferIntent.findFirst({ where: { storeId, gatewayReference }, select: { orderId: true } });
    let orderId = already?.orderId;
    if (!orderId) {
      const intent = await findMatchingIntent(storeId, amount);
      if (!intent) return false;
      const claim = await prisma.storeTransferIntent.updateMany({ where: { id: intent.id, status: "OPEN" }, data: { status: "PAID", gatewayReference } });
      if (claim.count === 0) return false;
      orderId = intent.orderId;
    }
    if (provider === "CASH") return false;
    const result = await settleOrderPayment({ orderId, reference: orderId, provider, verifiedAmountNaira: amount, verifiedCurrency: "NGN", payload: rawPayload });
    return result.outcome === "paid" || result.outcome === "already_paid";
  } catch (err) {
    void logError("PAYMENTS", "Could not match a transfer to its order", { storeId, gatewayReference, error: String(err) });
    return false;
  }
}
