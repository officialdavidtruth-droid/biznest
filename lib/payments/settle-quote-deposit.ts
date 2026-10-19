import "server-only";

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
  if (Math.abs(Number(payment.amount) - Number(verifiedAmountNaira)) > 0.01) {
    await flagPaymentForReview(reference, `quote deposit amount mismatch (paid ${verifiedAmountNaira}, expected ${Number(payment.amount)})`, rawPayload);
    return;
  }

  const quoteId = reference.split("-")[1];
  const quote = await prisma.quote.findUnique({ where: { id: quoteId } });
  if (!quote || quote.status === "ACCEPTED") return;

  await prisma.$transaction(async (tx) => {
    const paymentResult = await tx.payment.updateMany({
      where: { reference, status: "PENDING" },
      data: { status: "SUCCESSFUL", rawPayload, verifiedAt: new Date() },
    });
    if (paymentResult.count === 0) return;

    const freshQuote = await tx.quote.findUniqueOrThrow({ where: { id: quoteId }, include: { items: true } });
    if (freshQuote.status === "ACCEPTED" || !freshQuote.customerId) throw new Error("QUOTE_ALREADY_ACCEPTED_OR_CUSTOMER_MISSING");

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
}
