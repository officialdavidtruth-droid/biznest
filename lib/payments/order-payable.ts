import "server-only";
import { prisma } from "@/lib/prisma";

/**
 * Amount (in major currency units) still owed on an order.
 *
 * Order.total stays the full sale value. For an order that came from a quote,
 * the deposit the customer already paid (and that was settled and paid out to the
 * vendor) is credited here, so checkout never asks for it twice.
 * Reads the quote's own depositPayment, so orders created before the payment was
 * linked to the order are credited too.
 */
export async function getOrderPayableNaira(orderId: string, total: unknown): Promise<number> {
  const quote = await prisma.quote.findUnique({
    where: { orderId },
    select: { depositPayment: { select: { amount: true, status: true } } },
  });
  const credit = quote?.depositPayment?.status === "SUCCESSFUL" ? Number(quote.depositPayment.amount) : 0;
  return Math.max(0, Math.round((Number(total) - credit) * 100) / 100);
}
