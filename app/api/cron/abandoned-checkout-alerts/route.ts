import { prisma } from "@/lib/prisma";
import { notifyUser } from "@/lib/notifications/notify";
import { ABANDONED_CHECKOUT_THRESHOLD_MINUTES } from "@/lib/constants/order";
import { NextResponse } from "next/server";
import { logInfo, logError, errorMeta } from "@/lib/observability/log";

/**
 * Alerts a merchant the moment one of their buyers' checkouts crosses the
 * abandonment threshold, so they can act while the customer is still
 * plausibly reachable rather than discovering it whenever they next open
 * the dashboard. Configure as a Vercel Cron job (see vercel.json) with the
 * Authorization header `Bearer ${CRON_SECRET}`, same pattern as
 * app/api/cron/webhooks. Does NOT message the buyer -- that's still a
 * manual merchant action (lib/actions/abandoned-checkout.ts) so a merchant
 * isn't auto-spamming customers on channels they didn't choose.
 */
export async function GET(req: Request) {
  const auth = req.headers.get("authorization");
  if (auth !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const start = Date.now();
  const cutoff = new Date(Date.now() - ABANDONED_CHECKOUT_THRESHOLD_MINUTES * 60_000);

  const newlyAbandoned = await prisma.order.findMany({
    where: { status: "PENDING_PAYMENT", createdAt: { lt: cutoff }, merchantAlertedAt: null },
    include: { store: { include: { business: true } }, items: { include: { product: true, service: true } } },
    take: 200, // batch cap so one sweep can't run indefinitely
  });

  let failures = 0;
  for (const order of newlyAbandoned) {
    try {
      const label = order.items[0]?.product?.name ?? order.items[0]?.service?.name ?? "a cart";
      await notifyUser({
        userId: order.store.business.userId,
        type: "ABANDONED_CHECKOUT",
        title: "A customer left their cart",
        body: `${order.currency} ${Number(order.total).toLocaleString()} (${label}${order.items.length > 1 ? ` +${order.items.length - 1} more` : ""}) at ${order.store.name} — send a reminder?`,
        url: `/store/${order.store.slug}/admin/abandoned-checkouts`,
      });
      await prisma.order.update({ where: { id: order.id }, data: { merchantAlertedAt: new Date() } });
    } catch (err) {
      failures++;
      void logError("JOBS", "abandoned-checkout-alerts: notify failed", errorMeta(err, { orderId: order.id }));
    }
  }

  void logInfo(
    "JOBS",
    "abandoned-checkout-alerts completed",
    { processed: newlyAbandoned.length, failures },
    Date.now() - start
  );

  return NextResponse.json({ processed: newlyAbandoned.length, failures });
}
