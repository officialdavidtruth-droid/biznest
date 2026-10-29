import { prisma } from "@/lib/prisma";
import { recomputeAndPersistTrustScore } from "@/lib/actions/trust-score";

/**
 * Re-syncs everything derived from a store's Review rows:
 *   1. Business.avgRating / reviewCount (read by marketplace search, the
 *      storefront AggregateRating markup and the storefront rating badges)
 *   2. Business.trustScore (the reviews factor reads 1., and search sorts on
 *      the persisted column)
 *
 * Always recomputes from source rows rather than incrementing, so concurrent
 * or repeated calls converge on the right value and it can never drift.
 *
 * Lives outside lib/actions/reviews.ts on purpose: that file is "use server",
 * which would expose every export as a client-callable endpoint.
 */
export async function recomputeBusinessRating(storeId: string): Promise<void> {
  const store = await prisma.store.findUnique({ where: { id: storeId }, select: { businessId: true } });
  if (!store) return;

  const agg = await prisma.review.aggregate({
    where: { storeId },
    _avg: { rating: true },
    _count: { _all: true },
  });

  const reviewCount = agg._count._all;
  const avgRating = reviewCount > 0 && agg._avg.rating != null ? Math.round(agg._avg.rating * 10) / 10 : null;

  await prisma.business.update({ where: { id: store.businessId }, data: { avgRating, reviewCount } });

  // The rating summary is the source of truth; a trust-score failure must not
  // undo or fail it. The nightly trust-score backfill will catch up.
  try {
    await recomputeAndPersistTrustScore(store.businessId);
  } catch (err) {
    console.error("[reviews] trust score refresh failed", err);
  }
}
