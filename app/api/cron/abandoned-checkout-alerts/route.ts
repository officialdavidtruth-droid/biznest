import { prisma } from "@/lib/prisma";
import { requireCronAuth } from "@/lib/cron-auth";
import { notifyUser } from "@/lib/notifications/notify";
import { runAutomationsForEvent } from "@/lib/automations/engine";
import { ABANDONED_CHECKOUT_THRESHOLD_MINUTES } from "@/lib/constants/order";
import { NextResponse } from "next/server";
import { logInfo, logError, errorMeta } from "@/lib/observability/log";

/**
 * Alerts a merchant once one of their buyers' checkouts crosses the
 * abandonment threshold, so they can act while the customer is still
 * plausibly reachable. Configured as a Vercel Cron job (see vercel.json,
 * runs daily at 12:00 UTC) with the Authorization header
 * `Bearer ${CRON_SECRET}`, same pattern as app/api/cron/webhooks.
 *
 * On Vercel's Hobby plan, cron jobs can only run once a day, so "the
 * moment" here really means "within a day" -- a checkout abandoned at
 * 12:01 UTC won't be flagged until tomorrow's run. That's a real
 * degradation from a tighter cadence, but the check itself
 * (merchantAlertedAt null + past the threshold) is idempotent and doesn't
 * depend on run frequency, so it's safe either way -- an owner on Vercel
 * Pro (or any host without the daily-cron cap) can just tighten the
 * schedule in vercel.json, e.g. every 15 minutes, with no code change.
 *
 * Does NOT message the buyer -- that's still a manual merchant action
 * (lib/actions/abandoned-checkout.ts) so a merchant isn't auto-spamming
 * customers on channels they didn't choose.
 */
export async function GET(req: Request) {
  const denied = requireCronAuth(req);
  if (denied) return denied;

  const start = Date.now();
  const cutoff = new Date(Date.now() - ABANDONED_CHECKOUT_THRESHOLD_MINUTES * 60_000);

  const newlyAbandoned = await prisma.order.findMany({
    where: { status: "PENDING_PAYMENT", createdAt: { lt: cutoff }, merchantAlertedAt: null },
    include: { store: { include: { business: true } }, items: { include: { product: true, service: true } }, buyer: { select: { name: true, email: true } } },
    take: 200, // batch cap so one sweep can't run indefinitely
  });

  // One notification per customer per store, not per order: a buyer who
  // retries checkout leaves several PENDING_PAYMENT orders behind, and one
  // alert per row buried the bell in identical entries.
  const groups = new Map<string, typeof newlyAbandoned>();
  for (const order of newlyAbandoned) {
    const key = `${order.storeId}:${order.buyerId}`;
    groups.set(key, [...(groups.get(key) ?? []), order]);
  }

  let failures = 0;
  for (const orders of groups.values()) {
    // newest first, so the alert describes the cart they most recently left
    orders.sort((x, y) => y.createdAt.getTime() - x.createdAt.getTime());
    const latest = orders[0];
    try {
      const shipping = latest.shippingAddress as { fullName?: string } | null;
      const who = shipping?.fullName?.trim() || latest.buyer?.name?.trim() || latest.buyer?.email?.split("@")[0] || "A customer";
      const itemCount = latest.items.reduce((n, i) => n + i.quantity, 0);
      const first = latest.items[0]?.product?.name ?? latest.items[0]?.service?.name ?? "items";
      const extra = latest.items.length > 1 ? ` +${latest.items.length - 1} more` : "";
      const amount = `${latest.currency} ${Number(latest.total).toLocaleString()}`;
      await notifyUser({
        userId: latest.store.business.userId,
        type: "ABANDONED_CHECKOUT",
        title: `${who} left ${itemCount === 1 ? "an item" : "items"} in their cart`,
        body: `${first}${extra} · ${amount}${orders.length > 1 ? ` (${orders.length} attempts)` : ""}. Tap to send a reminder.`,
        url: `/store/${latest.store.slug}/admin/abandoned-checkouts?order=${latest.id}`,
      });
      await prisma.order.updateMany({ where: { id: { in: orders.map((o) => o.id) } }, data: { merchantAlertedAt: new Date() } });
      if (latest.buyer?.email) {
        await runAutomationsForEvent({ type: "CHECKOUT_ABANDONED", storeId: latest.storeId, data: { orderId: latest.id, email: latest.buyer.email } });
      }
    } catch (err) {
      failures++;
      void logError("JOBS", "abandoned-checkout-alerts: notify failed", errorMeta(err, { orderId: latest.id }));
    }
  }

  void logInfo(
    "JOBS",
    "abandoned-checkout-alerts completed",
    { processed: newlyAbandoned.length, notified: groups.size, failures },
    Date.now() - start
  );

  return NextResponse.json({ processed: newlyAbandoned.length, notified: groups.size, failures });
}