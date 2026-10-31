import "server-only";
import { amountCoversExpected } from "@/lib/payments/amount";
import { settleAndPayout } from "@/lib/payments/payout";

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
  if (!amountCoversExpected(Number(verifiedAmountNaira), Number(payment.amount))) {
    await flagPaymentForReview(reference, `invoice amount mismatch (paid ${verifiedAmountNaira}, expected ${Number(payment.amount)})`, rawPayload);
    return;
  }

  // A webhook/callback retry for a reference that already settled: nothing to do.
  // (settleAndPayout is idempotent, so re-running it also covers a crash between commit and payout.)
  if (payment.status === "SUCCESSFUL") {
    await settleAndPayout(reference);
    return;
  }

  const invoiceId = reference.split("-")[1];
  const invoice = await prisma.invoice.findUnique({ where: { id: invoiceId } });
  if (!invoice) {
    await flagPaymentForReview(reference, "verified invoice payment but invoice not found", rawPayload);
    return;
  }
  // The gateway collected money for an invoice that can no longer take it (the
  // customer paid twice, or the merchant marked it paid / cancelled it meanwhile).
  // Never drop that silently: stamp the Payment so it can be refunded or reconciled.
  if (invoice.status === "PAID" || invoice.status === "CANCELLED") {
    await flagPaymentForReview(reference, `duplicate or late invoice payment: invoice is already ${invoice.status}`, rawPayload);
    return;
  }

  try {
    await prisma.$transaction(async (tx) => {
      const paymentResult = await tx.payment.updateMany({
        where: { reference, status: { in: ["PENDING", "FAILED"] } },
        data: { status: "SUCCESSFUL", rawPayload, verifiedAt: new Date() },
      });
      if (paymentResult.count === 0) return;

      // Claim the invoice conditionally so a concurrent settlement can't both win.
      const claimed = await tx.invoice.updateMany({
        where: { id: invoiceId, status: { in: ["DRAFT", "SENT"] } },
        data: { status: "PAID", paidAt: new Date(), paymentId: payment.id },
      });
      if (claimed.count === 0) throw new Error("INVOICE_NO_LONGER_PAYABLE"); // rolls the payment claim back
      // Paid online: if this bill had been posted to a hotel room, drop that open charge so the guest isn't billed twice.
      await tx.propertyFolioCharge.updateMany({ where: { sourceType: "INVOICE", sourceId: invoiceId, status: "OPEN" }, data: { status: "VOID", voidedAt: new Date() } });
    }, { isolationLevel: "Serializable" });
  } catch (error) {
    if (error instanceof Error && error.message === "INVOICE_NO_LONGER_PAYABLE") {
      await flagPaymentForReview(reference, "duplicate or late invoice payment: invoice changed during settlement", rawPayload);
      return;
    }
    throw error; // e.g. serialization failure: let the gateway retry, which then takes the flag path above
  }

  await settleAndPayout(reference);
}
