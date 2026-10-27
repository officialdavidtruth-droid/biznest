import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { withCronMonitor } from "@/lib/observability/cron";
import { notifyUser } from "@/lib/notifications/notify";
import { sendOrderNotificationEmail } from "@/lib/email/send";
import { APP_URL } from "@/lib/constants/app-url";
import { logError, logInfo, errorMeta } from "@/lib/observability/log";
import { formatDailySummary, getStoreDailyTotals, hasSomethingToReport } from "@/lib/reports/daily-summary";

/**
 * Sends each store owner one end-of-day summary (sales, stock risks, unpaid
 * checkouts) as an in-app notification + push. Runs daily at 20:00 UTC (see
 * vercel.json). Totals use the shared getStoreDailyTotals(), so the message
 * uses the same rules as the dashboards (paid statuses only, store-local day).
 * Idempotent: one summary per store per local day (keyed on the notification url).
 */
const escapeHtml = (v: string) => v.replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]!));

export const GET = withCronMonitor("daily-summary", async () => {
  const started = Date.now();
  const stores = await prisma.store.findMany({
    where: { status: "ACTIVE" },
    select: { id: true, name: true, slug: true, timezone: true, currency: true, dailySummaryEmail: true, business: { select: { userId: true, user: { select: { email: true } } } } },
    take: 2000,
  });

  let sent = 0, emailed = 0, skipped = 0, failures = 0;
  for (const store of stores) {
    try {
      const totals = await getStoreDailyTotals(store);
      if (!hasSomethingToReport(totals)) { skipped++; continue; }
      const url = `/store/${store.slug}/admin?summary=${totals.dateKey}`;
      const already = await prisma.notification.findFirst({ where: { userId: store.business.userId, type: "DAILY_SUMMARY", url }, select: { id: true } });
      if (already) { skipped++; continue; }
      const { title, body } = formatDailySummary(store.name, totals);
      await notifyUser({ userId: store.business.userId, type: "DAILY_SUMMARY", title, body, url });
      sent++;
      // Email is opt-in per store and best-effort: a failed send must not
      // undo the notification above or block the other stores.
      const to = store.business.user?.email;
      if (store.dailySummaryEmail && to) {
        try {
          await sendOrderNotificationEmail(to, title, `${escapeHtml(body)}<br/><br/><a href="${APP_URL}${url}">Open your dashboard</a>`);
          emailed++;
        } catch (err) {
          void logError("EMAIL", "daily-summary: email failed", errorMeta(err, { storeId: store.id }));
        }
      }
    } catch (err) {
      failures++;
      void logError("JOBS", "daily-summary: store failed", errorMeta(err, { storeId: store.id }));
    }
  }

  void logInfo("JOBS", "daily-summary completed", { stores: stores.length, sent, emailed, skipped, failures }, Date.now() - started);
  return NextResponse.json({ stores: stores.length, sent, emailed, skipped, failures });
});
