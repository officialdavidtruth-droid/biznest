import { prisma } from "@/lib/prisma";
import { logError } from "@/lib/observability/log";

/**
 * A gateway confirmed money moved, but we could not safely apply it (amount
 * or currency mismatch, wrong provider, unknown order...). Never drop that
 * silently: log it loudly and stamp the Payment row so it can be found and
 * reconciled by hand. The Payment status is left alone (no enum change).
 */
export async function flagPaymentForReview(reference: string, reason: string, payload?: unknown) {
  void logError("PAYMENTS", `Payment needs manual review: ${reason}`, { reference });
  try {
    await prisma.payment.updateMany({
      where: { reference, status: { in: ["PENDING", "FAILED"] } },
      data: { rawPayload: { reviewReason: reason, flaggedAt: new Date().toISOString(), verification: (payload ?? null) as object | null } as object },
    });
  } catch (error) {
    void logError("PAYMENTS", "Could not stamp payment for review", { reference, error: String(error) });
  }
}
