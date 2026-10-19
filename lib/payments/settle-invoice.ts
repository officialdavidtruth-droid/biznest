import "server-only";

import { prisma } from "@/lib/prisma";
import { flagPaymentForReview } from "@/lib/payments/review";

/**
 * Invoice payment settlement.
 * Lives outside "use server" files on purpose: a "use server" export is a public
 * endpoint, and this takes caller-supplied amounts/payloads. Import it only from
 * the webhook and callback route handlers.
 */

/**
 * Called by the payment webhook/callback routes once a gateway charge with
 * an "INV-" reference verifies successfully. Idempotent: only transitions
 * an invoice still awaiting payment, keyed off the Payment row's own
 * affected-row count rather than a prior read, matching the Order
 * settlement pattern in the same routes.
 */
export async function settleInvoicePayment(reference: string, verifiedAmountNaira: number, rawPayload: object): Promise<void> {
  const payment = await prisma.payment.findUnique({ where: { reference } });
  if (!payment || payment.purpose !== "INVOICE" || !reference.startsWith("INV-")) return;
  if (Math.abs(Number(payment.amount) - Number(verifiedAmountNaira)) > 0.01) {
    await flagPaymentForReview(reference, `invoice amount mismatch (paid ${verifiedAmountNaira}, expected ${Number(payment.amount)})`, rawPayload);
    return;
  }

  const invoiceId = reference.split("-")[1];
  const invoice = await prisma.invoice.findUnique({ where: { id: invoiceId } });
  if (!invoice || invoice.status === "PAID") return;

  await prisma.$transaction(async (tx) => {
    const paymentResult = await tx.payment.updateMany({
      where: { reference, status: "PENDING" },
      data: { status: "SUCCESSFUL", rawPayload, verifiedAt: new Date() },
    });
    if (paymentResult.count === 0) return;

    await tx.invoice.update({
      where: { id: invoiceId },
      data: { status: "PAID", paidAt: new Date(), paymentId: payment.id },
    });
  }, { isolationLevel: "Serializable" });
}
