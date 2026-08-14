"use server";

import { prisma } from "@/lib/prisma";

// --- Deep store analytics ----------------------------------------------------
// Everything on the /admin/analytics dashboard, computed for an arbitrary
// day range. Kept separate from lib/actions/analytics.ts (which powers the
// small "your business today" widget on the main dashboard, a rolling 24h
// window) -- this one is the full report page: a longer configurable range,
// day-by-day series for charting, and the deeper breakdowns (best
// products/categories, returning customers, traffic sources).
//
// Revenue only ever counts orders that were actually paid for. REFUNDED and
// DISPUTED orders were paid at some point but shouldn't inflate a revenue
// number a seller is using to judge the health of their business -- same
// reasoning as SELLER_VISIBLE_ORDER_STATUSES, just narrower.
const REVENUE_STATUSES = ["PAID", "IN_PROGRESS", "DELIVERED", "COMPLETED"] as const;

export type DailyPoint = {
  date: string; // ISO yyyy-mm-dd
  label: string; // short display label, e.g. "13 Aug"
  revenue: number;
  orders: number;
  visitors: number;
  conversionRate: number | null; // orders ÷ visitors that day, null if too few visitors to mean anything
};

export type ProductStat = {
  id: string;
  name: string;
  unitsSold: number;
  revenue: number;
};

export type CategoryStat = {
  id: string;
  name: string;
  unitsSold: number;
  revenue: number;
};

export type TrafficSourceStat = {
  source: "Direct" | "Search" | "Social" | "Referral" | "Other";
  visits: number;
};

export type StoreAnalytics = {
  rangeDays: number;
  summary: {
    revenue: number;
    orders: number;
    customers: number; // distinct buyers with a real order in range
    conversionRate: number | null;
    averageOrderValue: number | null;
    abandonedCarts: number;
  };
  series: DailyPoint[];
  bestProducts: ProductStat[];
  bestCategories: CategoryStat[];
  returningCustomerRate: number | null;
  trafficSources: TrafficSourceStat[];
  /**
   * Profit is only ever computed from order items whose product/variant has
   * a seller-entered cost (InventoryItem.costPrice for simple products,
   * ProductVariant.costPrice for variant products -- the same fields
   * getInventoryProfitSummary() already reads). `coveragePct` is how much
   * of the range's revenue that covers, so the dashboard can show "profit
   * (based on 40% of revenue)" instead of a misleadingly complete number.
   * Null coverage/profit when nothing in range has a cost set yet.
   */
  profit: { amount: number; coveragePct: number } | null;
};

function bucketReferrer(referrer: string | null, storeHost: string | null): TrafficSourceStat["source"] {
  if (!referrer) return "Direct";
  let host: string;
  try {
    host = new URL(referrer).hostname.toLowerCase();
  } catch {
    return "Other";
  }
  if (storeHost && host === storeHost.toLowerCase()) return "Direct"; // internal navigation, e.g. product page from home page
  if (/(^|\.)google\.|(^|\.)bing\.|(^|\.)yahoo\.|(^|\.)duckduckgo\./.test(host)) return "Search";
  if (/(^|\.)facebook\.|(^|\.)instagram\.|(^|\.)tiktok\.|(^|\.)twitter\.|(^|\.)x\.com$|(^|\.)whatsapp\./.test(host)) return "Social";
  return "Referral";
}

export async function getStoreAnalytics(storeId: string, rangeDays = 30): Promise<StoreAnalytics> {
  const since = new Date();
  since.setDate(since.getDate() - (rangeDays - 1));
  since.setHours(0, 0, 0, 0);

  const [store, orders, visits, pendingCartCount] = await Promise.all([
    prisma.store.findUnique({ where: { id: storeId }, select: { customDomain: true, slug: true } }),
    prisma.order.findMany({
      where: { storeId, status: { in: [...REVENUE_STATUSES] }, createdAt: { gte: since } },
      select: {
        id: true,
        total: true,
        createdAt: true,
        buyerId: true,
        items: {
          select: {
            quantity: true,
            unitPrice: true,
            productId: true,
            variantId: true,
            variant: { select: { costPrice: true } },
            product: {
              select: {
                id: true,
                name: true,
                categoryId: true,
                category: { select: { id: true, name: true } },
                inventory: { select: { costPrice: true } },
              },
            },
          },
        },
      },
    }),
    prisma.storeVisit.findMany({
      where: { storeId, createdAt: { gte: since } },
      select: { createdAt: true, referrer: true },
    }),
    // Same "started but never finished, and it's been long enough it's not
    // just mid-checkout" definition used in lib/actions/analytics.ts.
    prisma.order.count({
      where: { storeId, status: "PENDING_PAYMENT", createdAt: { lte: new Date(Date.now() - 60 * 60 * 1000), gte: since } },
    }),
  ]);

  const storeHost = store?.customDomain ?? null;

  // ---------- Day-by-day series ----------
  const series: DailyPoint[] = [];
  for (let i = 0; i < rangeDays; i++) {
    const d = new Date(since);
    d.setDate(d.getDate() + i);
    const key = d.toDateString();
    const dayOrders = orders.filter((o) => o.createdAt.toDateString() === key);
    const dayVisitors = visits.filter((v) => v.createdAt.toDateString() === key).length;
    const dayRevenue = dayOrders.reduce((s, o) => s + Number(o.total), 0);
    series.push({
      date: d.toISOString().slice(0, 10),
      label: d.toLocaleDateString(undefined, { day: "numeric", month: "short" }),
      revenue: dayRevenue,
      orders: dayOrders.length,
      visitors: dayVisitors,
      conversionRate: dayVisitors >= 5 ? Math.round((dayOrders.length / dayVisitors) * 1000) / 10 : null,
    });
  }

  // ---------- Summary ----------
  const revenue = orders.reduce((s, o) => s + Number(o.total), 0);
  const distinctBuyers = new Set(orders.map((o) => o.buyerId));
  const totalVisitors = visits.length;
  const conversionRate = totalVisitors >= 20 ? Math.round((orders.length / totalVisitors) * 1000) / 10 : null;
  const averageOrderValue = orders.length > 0 ? Math.round((revenue / orders.length) * 100) / 100 : null;

  // ---------- Best products / categories ----------
  const productMap = new Map<string, ProductStat>();
  const categoryMap = new Map<string, CategoryStat>();
  let coveredRevenue = 0;
  let profitAmount = 0;
  let hasAnyCost = false;

  for (const order of orders) {
    for (const item of order.items) {
      const lineRevenue = Number(item.unitPrice) * item.quantity;
      if (item.product) {
        const p = item.product;
        const existing = productMap.get(p.id) ?? { id: p.id, name: p.name, unitsSold: 0, revenue: 0 };
        existing.unitsSold += item.quantity;
        existing.revenue += lineRevenue;
        productMap.set(p.id, existing);

        if (p.category) {
          const existingCat = categoryMap.get(p.category.id) ?? { id: p.category.id, name: p.category.name, unitsSold: 0, revenue: 0 };
          existingCat.unitsSold += item.quantity;
          existingCat.revenue += lineRevenue;
          categoryMap.set(p.category.id, existingCat);
        }

        // Cost comes from the real tracked source: a variant's own
        // costPrice for variant products, otherwise the simple product's
        // InventoryItem.costPrice -- same fields getInventoryProfitSummary()
        // already reads in lib/actions/inventory.ts. Nothing estimated.
        const cost = item.variant?.costPrice ?? item.product.inventory?.costPrice ?? null;
        if (cost != null) {
          hasAnyCost = true;
          coveredRevenue += lineRevenue;
          profitAmount += lineRevenue - Number(cost) * item.quantity;
        }
      }
    }
  }
  const bestProducts = [...productMap.values()].sort((a, b) => b.unitsSold - a.unitsSold).slice(0, 8);
  const bestCategories = [...categoryMap.values()].sort((a, b) => b.revenue - a.revenue).slice(0, 8);

  // ---------- Returning customers ----------
  let returningCustomerRate: number | null = null;
  if (orders.length >= 5) {
    const counts = new Map<string, number>();
    for (const { buyerId } of orders) counts.set(buyerId, (counts.get(buyerId) ?? 0) + 1);
    const returning = [...counts.values()].filter((c) => c > 1).length;
    returningCustomerRate = Math.round((returning / counts.size) * 100);
  }

  // ---------- Traffic sources ----------
  const sourceCounts = new Map<TrafficSourceStat["source"], number>();
  for (const v of visits) {
    const source = bucketReferrer(v.referrer, storeHost);
    sourceCounts.set(source, (sourceCounts.get(source) ?? 0) + 1);
  }
  const trafficSources: TrafficSourceStat[] = [...sourceCounts.entries()]
    .map(([source, visits]) => ({ source, visits }))
    .sort((a, b) => b.visits - a.visits);

  return {
    rangeDays,
    summary: {
      revenue,
      orders: orders.length,
      customers: distinctBuyers.size,
      conversionRate,
      averageOrderValue,
      abandonedCarts: pendingCartCount,
    },
    series,
    bestProducts,
    bestCategories,
    returningCustomerRate,
    trafficSources,
    profit: hasAnyCost
      ? { amount: Math.round(profitAmount * 100) / 100, coveragePct: revenue > 0 ? Math.round((coveredRevenue / revenue) * 100) : 0 }
      : null,
  };
}
