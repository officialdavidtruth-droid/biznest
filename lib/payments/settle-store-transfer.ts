import "server-only";
import { prisma } from "@/lib/prisma";
import { settleAndPayout } from "@/lib/payments/payout";
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
