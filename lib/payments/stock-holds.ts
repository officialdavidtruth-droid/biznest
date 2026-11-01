import "server-only";
import { prisma } from "@/lib/prisma";

/** Unpaid bank-transfer orders hold their stock for this long, or until the vendor confirms or the order is cancelled. */
export const TRANSFER_HOLD_HOURS = 24;

/**
 * Units of each product and variant promised to bank-transfer orders that are not paid yet.
 *
 * Stock is only subtracted when the vendor confirms a transfer, so without this two customers could both be
 * told the last unit is available. An order counts as holding stock while it is PENDING_PAYMENT by bank
 * transfer and either the customer uploaded proof (it is waiting for the vendor) or it is younger than
 * TRANSFER_HOLD_HOURS. Needs no stored reservation: it is derived from the open orders, so it frees itself when an
 * order is confirmed, cancelled or ages out. `excludeBuyerId` leaves out the shopper's own open orders so
 * retrying checkout is not blocked by the order they are retrying.
 */
export async function getTransferHolds(
  storeId: string,
  opts: { productIds: string[]; variantIds: string[]; excludeBuyerId?: string | null },
): Promise<{ byProduct: Map<string, number>; byVariant: Map<string, number> }> {
  const byProduct = new Map<string, number>();
  const byVariant = new Map<string, number>();
  if (!opts.productIds.length && !opts.variantIds.length) return { byProduct, byVariant };

  const items = await prisma.orderItem.findMany({
    where: {
      OR: [
        ...(opts.productIds.length ? [{ productId: { in: opts.productIds }, variantId: null }] : []),
        ...(opts.variantIds.length ? [{ variantId: { in: opts.variantIds } }] : []),
      ],
      order: {
        storeId,
        status: "PENDING_PAYMENT",
        paymentProvider: "CASH",
        ...(opts.excludeBuyerId ? { buyerId: { not: opts.excludeBuyerId } } : {}),
        OR: [{ paymentProofUrl: { not: null } }, { createdAt: { gte: new Date(Date.now() - TRANSFER_HOLD_HOURS * 3_600_000) } }],
      },
    },
    select: { productId: true, variantId: true, quantity: true },
  });

  for (const i of items) {
    if (i.variantId) byVariant.set(i.variantId, (byVariant.get(i.variantId) ?? 0) + i.quantity);
    else if (i.productId) byProduct.set(i.productId, (byProduct.get(i.productId) ?? 0) + i.quantity);
  }
  return { byProduct, byVariant };
}
