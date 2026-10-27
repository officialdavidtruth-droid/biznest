import type { OrderStatus } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { addLocalDays, getLocalDateKey, localDateEndUtc, localDateStartUtc } from "@/lib/timezone";
import { formatNumber } from "@/lib/i18n/locale";

/**
 * Money actually received and kept. Single definition for "a sale" in the
 * daily summary; REFUNDED, DISPUTED, CANCELLED and PENDING_PAYMENT never count.
 */
export const SALE_STATUSES: OrderStatus[] = ["PAID", "IN_PROGRESS", "DELIVERED", "COMPLETED"];

export type DailyTotals = {
  dateKey: string; // store-local yyyy-mm-dd
  currency: string;
  orders: number;
  revenue: number;
  ordersYesterday: number;
  revenueYesterday: number;
  unpaidOrders: number; // checkouts started today, not paid, not counted as sales
  unpaidValue: number;
  lowStock: number;
  outOfStock: number;
};

/** Totals for the store's local "today" (or the day of `at`). No auth: callers must be trusted (cron). */
export async function getStoreDailyTotals(store: { id: string; timezone: string | null; currency: string | null }, at = new Date()): Promise<DailyTotals> {
  const tz = store.timezone || "Africa/Lagos";
  const dateKey = getLocalDateKey(at, tz);
  const start = localDateStartUtc(dateKey, tz);
  const end = localDateEndUtc(dateKey, tz);
  const yStart = localDateStartUtc(addLocalDays(dateKey, -1), tz);
  const yEnd = new Date(yStart.getTime() + (at.getTime() - start.getTime())); // same elapsed time yesterday
  const storeId = store.id;

  const [today, yesterday, unpaid, inventory, variants] = await Promise.all([
    prisma.order.aggregate({ where: { storeId, status: { in: SALE_STATUSES }, createdAt: { gte: start, lt: end } }, _count: { _all: true }, _sum: { total: true } }),
    prisma.order.aggregate({ where: { storeId, status: { in: SALE_STATUSES }, createdAt: { gte: yStart, lt: yEnd } }, _count: { _all: true }, _sum: { total: true } }),
    prisma.order.aggregate({ where: { storeId, status: "PENDING_PAYMENT", createdAt: { gte: start, lt: end } }, _count: { _all: true }, _sum: { total: true } }),
    prisma.inventoryItem.findMany({ where: { product: { storeId, isPublished: true, hasVariants: false } }, select: { quantity: true, lowStockThreshold: true } }),
    prisma.productVariant.findMany({ where: { isActive: true, product: { storeId, isPublished: true, hasVariants: true } }, select: { quantity: true, lowStockThreshold: true } }),
  ]);

  const stock = [...inventory, ...variants];
  return {
    dateKey,
    currency: store.currency || "NGN",
    orders: today._count._all,
    revenue: Number(today._sum.total ?? 0),
    ordersYesterday: yesterday._count._all,
    revenueYesterday: Number(yesterday._sum.total ?? 0),
    unpaidOrders: unpaid._count._all,
    unpaidValue: Number(unpaid._sum.total ?? 0),
    lowStock: stock.filter((s) => s.quantity > 0 && s.quantity <= s.lowStockThreshold).length,
    outOfStock: stock.filter((s) => s.quantity <= 0).length,
  };
}

/** True when there is something worth a merchant's attention; quiet days send nothing. */
export function hasSomethingToReport(t: DailyTotals): boolean {
  return t.orders > 0 || t.unpaidOrders > 0 || t.lowStock > 0 || t.outOfStock > 0;
}

export function formatDailySummary(storeName: string, t: DailyTotals): { title: string; body: string } {
  const money = (n: number) => `${t.currency} ${formatNumber(n)}`;
  const parts: string[] = [];
  parts.push(t.orders === 0 ? "No paid sales yet today." : `${t.orders} paid order${t.orders === 1 ? "" : "s"} · ${money(t.revenue)}.`);
  if (t.ordersYesterday > 0 || t.revenueYesterday > 0) parts.push(`Same time yesterday: ${t.ordersYesterday} · ${money(t.revenueYesterday)}.`);
  const attention: string[] = [];
  if (t.outOfStock > 0) attention.push(`${t.outOfStock} out of stock`);
  if (t.lowStock > 0) attention.push(`${t.lowStock} running low`);
  if (t.unpaidOrders > 0) attention.push(`${t.unpaidOrders} unpaid checkout${t.unpaidOrders === 1 ? "" : "s"} (${money(t.unpaidValue)}, not counted as sales)`);
  if (attention.length) parts.push(`Needs attention: ${attention.join(", ")}.`);
  return { title: `${storeName}: today's summary`, body: parts.join(" ") };
}
