"use server";

import { prisma } from "@/lib/prisma";
import { SELLER_VISIBLE_ORDER_STATUSES } from "@/lib/constants/order";

/**
 * Records one storefront page view. Fire-and-forget, best-effort: analytics
 * must never be able to break or slow down a buyer's page load, so every
 * call site wraps this in a call that ignores its result/errors.
 *
 * Deliberately only called from real buyer-facing pages (storefront home,
 * category, product — see those page.tsx files), never from /admin. A
 * seller looking at their own dashboard, or the template gallery rendering
 * a cover preview, must never inflate their own visitor count.
 */
export async function recordStoreVisit(storeId: string, path: string): Promise<void> {
  try {
    await prisma.storeVisit.create({ data: { storeId, path } });
  } catch {
    // Never let analytics logging take down a storefront page.
  }
}

export type Recommendation = {
  id: string;
  severity: "info" | "warning";
  message: string;
  actionLabel: string;
  actionHref: string;
};

export type DashboardInsights = {
  revenueToday: number;
  ordersToday: number;
  visitorsToday: number;
  /** Orders-today ÷ visitors-today, as a 0–100 percentage. Null when there
   * isn't enough visitor data yet to make the number meaningful, rather
   * than showing a misleading 0% or a divide-by-zero. */
  conversionRate: number | null;
  bestProduct: { id: string; name: string; unitsSold: number } | null;
  returningCustomerRate: number | null;
  recommendations: Recommendation[];
};

const PAID_STATUSES = SELLER_VISIBLE_ORDER_STATUSES;

/**
 * Everything the "Your business today" + "BizNest recommends" sections need,
 * computed in one place so the dashboard reads real signals instead of raw
 * counts. "Today" is a rolling 24h window rather than calendar-midnight, so
 * the numbers don't reset to zero at 00:00 and look artificially empty for
 * whoever checks first thing in the morning.
 */
export async function getDashboardInsights(storeId: string, slug: string): Promise<DashboardInsights> {
  const since24h = new Date(Date.now() - 24 * 60 * 60 * 1000);
  const since7d = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);

  const [
    ordersToday,
    visitorsToday,
    revenueAgg,
    itemsSold,
    allBuyerIds,
    abandonedCartCount,
    lowStockProducts,
    productsMissingReviews,
    recentCoupon,
  ] = await Promise.all([
    prisma.order.count({ where: { storeId, status: { in: PAID_STATUSES }, createdAt: { gte: since24h } } }),
    // Distinct paths aren't deduped by visitor here — see StoreVisit's doc
    // comment: this is a simple page-view count, not unique-visitor tracking.
    prisma.storeVisit.count({ where: { storeId, createdAt: { gte: since24h } } }),
    prisma.order.aggregate({
      where: { storeId, status: { in: PAID_STATUSES }, createdAt: { gte: since24h } },
      _sum: { total: true },
    }),
    prisma.orderItem.groupBy({
      by: ["productId"],
      where: { productId: { not: null }, order: { storeId, status: { in: PAID_STATUSES } } },
      _sum: { quantity: true },
      orderBy: { _sum: { quantity: "desc" } },
      take: 1,
    }),
    prisma.order.findMany({
      where: { storeId, status: { in: PAID_STATUSES } },
      select: { buyerId: true },
    }),
    // A checkout was started (an Order row exists) but never completed, and
    // it's been long enough that it's not just mid-checkout right now —
    // the real-world definition of an abandoned cart on this schema.
    prisma.order.count({
      where: { storeId, status: "PENDING_PAYMENT", createdAt: { lte: new Date(Date.now() - 60 * 60 * 1000), gte: since7d } },
    }),
    prisma.product.findMany({
      where: { storeId, isPublished: true, inventory: { quantity: { gt: 0 } } },
      select: { id: true, name: true, inventory: { select: { quantity: true, lowStockThreshold: true } } },
    }),
    prisma.product.count({
      where: { storeId, isPublished: true, reviews: { none: {} } },
    }),
    // Coupon has no createdAt field, so we can't check "created in the last
    // 7 days" — fall back to whether an active coupon exists at all.
    prisma.coupon.findFirst({ where: { storeId, isActive: true }, select: { id: true } }),
  ]);

  const revenueToday = Number(revenueAgg._sum.total ?? 0);

  let bestProduct: DashboardInsights["bestProduct"] = null;
  if (itemsSold.length > 0 && itemsSold[0].productId) {
    const p = await prisma.product.findUnique({ where: { id: itemsSold[0].productId }, select: { id: true, name: true } });
    if (p) bestProduct = { id: p.id, name: p.name, unitsSold: itemsSold[0]._sum.quantity ?? 0 };
  }

  // Returning-customer rate: of buyers who've ever completed an order here,
  // what share have completed more than one. Needs at least a handful of
  // orders to mean anything, otherwise it's just noise (e.g. "100%" off a
  // single repeat buyer out of two total orders).
  let returningCustomerRate: number | null = null;
  if (allBuyerIds.length >= 5) {
    const counts = new Map<string, number>();
    for (const { buyerId } of allBuyerIds) counts.set(buyerId, (counts.get(buyerId) ?? 0) + 1);
    const returning = [...counts.values()].filter((c) => c > 1).length;
    returningCustomerRate = Math.round((returning / counts.size) * 100);
  }

  const conversionRate = visitorsToday >= 20 ? Math.round((ordersToday / visitorsToday) * 1000) / 10 : null;

  const recommendations: Recommendation[] = [];

  if (conversionRate !== null && conversionRate < 5 && productsMissingReviews > 0) {
    recommendations.push({
      id: "low-conversion-reviews",
      severity: "warning",
      message: `Your store received ${visitorsToday.toLocaleString()} visitors but only ${conversionRate}% purchased. Add product reviews to improve conversion.`,
      actionLabel: "Review products",
      actionHref: `/store/${slug}/admin/reviews`,
    });
  }

  const lowStockBest = bestProduct
    ? lowStockProducts.find((p) => p.id === bestProduct!.id && p.inventory && p.inventory.quantity <= p.inventory.lowStockThreshold)
    : null;
  if (lowStockBest) {
    recommendations.push({
      id: "best-product-low-stock",
      severity: "warning",
      message: `Your best-selling product, ${bestProduct!.name}, is running low on stock.`,
      actionLabel: "Restock now",
      actionHref: `/store/${slug}/admin/inventory`,
    });
  }

  if (abandonedCartCount > 0) {
    recommendations.push({
      id: "abandoned-carts",
      severity: "warning",
      message: `You have ${abandonedCartCount} abandoned cart${abandonedCartCount === 1 ? "" : "s"} from the last 7 days. Following up can recover some of that revenue.`,
      actionLabel: "View orders",
      actionHref: `/store/${slug}/admin/orders`,
    });
  }

  if (!recentCoupon) {
    recommendations.push({
      id: "no-promo-this-week",
      severity: "info",
      message: "You don't have an active promotion right now. A short-term coupon is one of the fastest ways to bring visitors back.",
      actionLabel: "Create a coupon",
      actionHref: `/store/${slug}/admin/marketing`,
    });
  }

  if (productsMissingReviews > 0 && !recommendations.some((r) => r.id === "low-conversion-reviews")) {
    recommendations.push({
      id: "missing-reviews",
      severity: "info",
      message: `${productsMissingReviews} product${productsMissingReviews === 1 ? " has" : "s have"} no reviews yet. Reviews are one of the strongest trust signals for new buyers.`,
      actionLabel: "View products",
      actionHref: `/store/${slug}/admin/products`,
    });
  }

  return {
    revenueToday,
    ordersToday,
    visitorsToday,
    conversionRate,
    bestProduct,
    returningCustomerRate,
    recommendations,
  };
}
