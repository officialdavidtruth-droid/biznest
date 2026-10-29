import "server-only";
import { amountCoversExpected } from "@/lib/payments/amount";
import { settleAndPayout } from "@/lib/payments/payout";

import { prisma } from "@/lib/prisma";
import { flagPaymentForReview } from "@/lib/payments/review";

/**
 * Quote deposit settlement.
 * Lives outside "use server" files on purpose: a "use server" export is a public
 * endpoint, and this takes caller-supplied amounts/payloads. Import it only from
 * the webhook and callback route handlers.
 */

/**
 * Called by the payment webhook/callback routes once a gateway charge with
 * a "QDEP-" reference verifies successfully. Idempotent: bails out if the
 * quote is already ACCEPTED (e.g. a webhook retry racing the browser
 * callback), matching the settlement pattern used for Orders and Invoices
 * in the same routes.
 */
export async function settleQuoteDeposit(reference: string, verifiedAmountNaira: number, rawPayload: object): Promise<void> {
  const payment = await prisma.payment.findUnique({ where: { reference } });
  if (!payment || payment.purpose !== "QUOTE_DEPOSIT" || !reference.startsWith("QDEP-")) return;
  if (!amountCoversExpected(Number(verifiedAmountNaira), Number(payment.amount))) {
    await flagPaymentForReview(reference, `quote deposit amount mismatch (paid ${verifiedAmountNaira}, expected ${Number(payment.amount)})`, rawPayload);
    return;
  }

  // A webhook/callback retry for a reference that already settled: nothing to do.
  // (settleAndPayout is idempotent, so re-running it also covers a crash between commit and payout.)
  if (payment.status === "SUCCESSFUL") {
    await settleAndPayout(reference);
    return;
  }

  const quoteId = reference.split("-")[1];
  const quote = await prisma.quote.findUnique({ where: { id: quoteId } });
  if (!quote) {
    await flagPaymentForReview(reference, "verified quote deposit but quote not found", rawPayload);
    return;
  }
  // Money was collected for a quote that can't take it (a second deposit after
  // acceptance, or the quote was declined/expired meanwhile). Flag it for the
  // merchant to refund or honour rather than leaving the Payment stuck PENDING.
  if (quote.status !== "SENT") {
    await flagPaymentForReview(reference, `duplicate or late quote deposit: quote is already ${quote.status}`, rawPayload);
    return;
  }
  if (!quote.customerId) {
    await flagPaymentForReview(reference, "quote deposit verified but quote has no customer to create the order for", rawPayload);
    return;
  }

  try {
    await prisma.$transaction(async (tx) => {
      const paymentResult = await tx.payment.updateMany({
        where: { reference, status: { in: ["PENDING", "FAILED"] } },
        data: { status: "SUCCESSFUL", rawPayload, verifiedAt: new Date() },
      });
      if (paymentResult.count === 0) return;

      const freshQuote = await tx.quote.findUniqueOrThrow({ where: { id: quoteId }, include: { items: true } });
      if (freshQuote.status !== "SENT" || !freshQuote.customerId) throw new Error("QUOTE_NO_LONGER_OPEN"); // rolls the payment claim back

      const order = await tx.order.create({
        data: {
          storeId: freshQuote.storeId,
          buyerId: freshQuote.customerId,
          status: "PENDING_PAYMENT",
          subtotal: freshQuote.subtotal,
          total: freshQuote.total,
          currency: freshQuote.currency,
          paymentProvider: payment.provider,
          items: { create: freshQuote.items.map((i) => ({ quantity: i.quantity, unitPrice: i.unitPrice })) },
        },
      });

      await tx.quote.update({
        where: { id: quoteId },
        data: { status: "ACCEPTED", respondedAt: new Date(), orderId: order.id, depositPaymentId: payment.id },
      });
    }, { isolationLevel: "Serializable" });
  } catch (error) {
    if (error instanceof Error && error.message === "QUOTE_NO_LONGER_OPEN") {
      await flagPaymentForReview(reference, "duplicate or late quote deposit: quote changed during settlement", rawPayload);
      return;
    }
    throw error; // e.g. serialization failure: let the gateway retry, which then takes the flag path above
  }

  await settleAndPayout(reference);
}
