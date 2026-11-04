import { prisma } from "@/lib/prisma";
import { notifyUser } from "@/lib/notifications/notify";
import { sendOrderNotificationEmail } from "@/lib/email/send";
import { APP_URL } from "@/lib/constants/app-url";
import { logError, errorMeta } from "@/lib/observability/log";
import { formatNumber } from "@/lib/i18n/locale";
import { SALE_STATUSES } from "@/lib/reports/daily-summary";

/**
 * "How your store did this week" -- one short recap per store owner on Monday morning.
 * Pure formatting lives in buildWeeklyRecap() so it can be unit-tested without a database.
 */
export type WeeklyRecapInput = {
  currency: string;
  orders: number;
  revenue: number;
  prevOrders: number;
  prevRevenue: number;
  topItem: { name: string; quantity: number } | null;
};

export function hasWeeklyActivity(i: WeeklyRecapInput): boolean {
  return i.orders > 0 || i.prevOrders > 0;
}

function change(now: number, before: number): string | null {
  if (before <= 0) return null;
  const pct = Math.round(((now - before) / before) * 100);
  if (pct === 0) return "same as the week before";
  return `${pct > 0 ? "up" : "down"} ${Math.abs(pct)}% on the week before`;
}

export function buildWeeklyRecap(storeName: string, i: WeeklyRecapInput): { title: string; body: string } {
  const money = (n: number) => `${i.currency} ${formatNumber(n)}`;
  const parts: string[] = [];
  if (i.orders === 0) {
    parts.push("No paid sales in the last 7 days.");
    if (i.prevOrders > 0) parts.push(`The week before: ${i.prevOrders} order${i.prevOrders === 1 ? "" : "s"} · ${money(i.prevRevenue)}.`);
    parts.push("Share your store link on WhatsApp or Instagram to get things moving.");
  } else {
    const trend = change(i.revenue, i.prevRevenue);
    parts.push(`${i.orders} paid order${i.orders === 1 ? "" : "s"} · ${money(i.revenue)}${trend ? ` (${trend})` : ""}.`);
    if (i.topItem) parts.push(`Best seller: ${i.topItem.name} (${i.topItem.quantity} sold).`);
  }
  return { title: `${storeName}: your week`, body: parts.join(" ") };
}

const escapeHtml = (v: string) => v.replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]!));

export async function sendWeeklyRecaps(now = new Date()) {
  let sent = 0, emailed = 0, skipped = 0, failures = 0;
  const weekMs = 7 * 86_400_000;
  const start = new Date(now.getTime() - weekMs);
  const prevStart = new Date(now.getTime() - 2 * weekMs);
  // One recap per store per Monday: keyed on the notification url, like the daily summary.
  const weekKey = now.toISOString().slice(0, 10);

  const stores = await prisma.store.findMany({
    where: { status: "ACTIVE" },
    select: { id: true, name: true, slug: true, currency: true, dailySummaryEmail: true, business: { select: { userId: true, user: { select: { email: true } } } } },
    take: 2000,
  });

  for (const store of stores) {
    try {
      const where = { storeId: store.id, status: { in: SALE_STATUSES } };
      const [cur, prev] = await Promise.all([
        prisma.order.aggregate({ where: { ...where, createdAt: { gte: start, lt: now } }, _count: { _all: true }, _sum: { total: true } }),
        prisma.order.aggregate({ where: { ...where, createdAt: { gte: prevStart, lt: start } }, _count: { _all: true }, _sum: { total: true } }),
      ]);
      const input: WeeklyRecapInput = {
        currency: store.currency || "NGN",
        orders: cur._count._all,
        revenue: Number(cur._sum.total ?? 0),
        prevOrders: prev._count._all,
        prevRevenue: Number(prev._sum.total ?? 0),
        topItem: null,
      };
      if (!hasWeeklyActivity(input)) { skipped++; continue; }

      if (input.orders > 0) {
        const top = await prisma.orderItem.groupBy({
          by: ["productId", "serviceId"],
          where: { order: { ...where, createdAt: { gte: start, lt: now } } },
          _sum: { quantity: true },
          orderBy: { _sum: { quantity: "desc" } },
          take: 1,
        });
        const row = top[0];
        if (row) {
          const name = row.productId
            ? (await prisma.product.findUnique({ where: { id: row.productId }, select: { name: true } }))?.name
            : row.serviceId
              ? (await prisma.service.findUnique({ where: { id: row.serviceId }, select: { name: true } }))?.name
              : null;
          if (name) input.topItem = { name, quantity: row._sum.quantity ?? 0 };
        }
      }

      const url = `/store/${store.slug}/admin?week=${weekKey}`;
      const already = await prisma.notification.findFirst({ where: { userId: store.business.userId, type: "WEEKLY_RECAP", url }, select: { id: true } });
      if (already) { skipped++; continue; }
      const { title, body } = buildWeeklyRecap(store.name, input);
      await notifyUser({ userId: store.business.userId, type: "WEEKLY_RECAP", title, body, url });
      sent++;
      const to = store.business.user?.email;
      if (store.dailySummaryEmail && to) {
        try {
          await sendOrderNotificationEmail(to, title, `${escapeHtml(body)}<br/><br/><a href="${APP_URL}${url}">Open your dashboard</a>`);
          emailed++;
        } catch (err) {
          void logError("EMAIL", "weekly-recap: email failed", errorMeta(err, { storeId: store.id }));
        }
      }
    } catch (err) {
      failures++;
      void logError("JOBS", "weekly-recap: store failed", errorMeta(err, { storeId: store.id }));
    }
  }
  return { sent, emailed, skipped, failures };
}
