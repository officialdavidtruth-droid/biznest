import { prisma } from "@/lib/prisma";
import { withCronMonitor } from "@/lib/observability/cron";
import { notifyUser } from "@/lib/notifications/notify";
import { runAutomationsForEvent } from "@/lib/automations/engine";
import { ABANDONED_CHECKOUT_THRESHOLD_MINUTES } from "@/lib/constants/order";
import { NextResponse } from "next/server";
import { logInfo, logError, errorMeta } from "@/lib/observability/log";
import { formatNumber } from "@/lib/i18n/locale";
import { HOTEL_CATEGORY_ALIASES } from "@/lib/business-identity";
import { messageCustomer } from "@/lib/customer-messaging";
import { abandonedCartText } from "@/lib/customer-messages";
import { buildStoreUrl } from "@/lib/store-url";

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
 * Messages the buyer (WhatsApp, then SMS) ONLY for stores that switched on
 * "abandoned cart reminders" (Store.msgAbandonedCart, off by default), once per
 * cart and never when the merchant already sent a recovery message by hand
 * (lib/actions/abandoned-checkout.ts). Everyone else keeps the manual flow.
 */
export const GET = withCronMonitor("abandoned-checkout-alerts", async () => {

  const start = Date.now();
  const cutoff = new Date(Date.now() - ABANDONED_CHECKOUT_THRESHOLD_MINUTES * 60_000);

  const newlyAbandoned = await prisma.order.findMany({
    where: {
      status: "PENDING_PAYMENT", createdAt: { lt: cutoff }, merchantAlertedAt: null,
      // Bank-transfer orders awaiting the vendor are not abandoned carts.
      OR: [{ paymentProvider: null }, { paymentProvider: { not: "CASH" } }],
      // Cart-checkout businesses only: no alerts for hotels (reservations) or service-only stores.
      store: { business: { sellsProducts: true, NOT: { category: { in: HOTEL_CATEGORY_ALIASES, mode: "insensitive" } } } },
    },
    include: { store: { include: { business: true } }, items: { include: { product: true, service: true } }, buyer: { select: { name: true, email: true } }, abandonedNotifications: { select: { status: true } } },
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
  let customerReminders = 0;
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
      const amount = `${latest.currency} ${formatNumber(Number(latest.total))}`;
      await notifyUser({
        userId: latest.store.business.userId,
        type: "ABANDONED_CHECKOUT",
        title: `${who} left ${itemCount === 1 ? "an item" : "items"} in their cart`,
        body: `${first}${extra} · ${amount}${orders.length > 1 ? ` (${orders.length} attempts)` : ""}. Tap to send a reminder.`,
        url: `/store/${latest.store.slug}/admin/abandoned-checkouts?order=${latest.id}`,
      });
      await prisma.order.updateMany({ where: { id: { in: orders.map((o) => o.id) } }, data: { merchantAlertedAt: new Date() } });
      if (latest.store.msgAbandonedCart && !orders.some((o) => o.abandonedNotifications.some((n) => n.status === "SENT"))) {
        const ship = latest.shippingAddress as { fullName?: string; phone?: string } | null;
        const outcome = await messageCustomer({
          phone: ship?.phone,
          firstName: ship?.fullName ?? latest.buyer?.name,
          storeName: latest.store.name,
          text: abandonedCartText({ storeName: latest.store.name, itemLabel: `${first}${extra}`, cartUrl: buildStoreUrl(latest.store, "/cart") }),
          dedupeKey: `abandoned:${latest.id}`,
          perHour: 2,
        });
        if (outcome.sent) {
          customerReminders++;
          await prisma.abandonedCheckoutNotification.create({ data: { orderId: latest.id, channel: outcome.channel, status: "SENT" } });
        } else if (outcome.reason === "failed") {
          await prisma.abandonedCheckoutNotification.create({ data: { orderId: latest.id, channel: "SMS", status: "FAILED", error: outcome.detail ?? null } });
        }
      }
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
    { processed: newlyAbandoned.length, notified: groups.size, customerReminders, failures },
    Date.now() - start
  );

  return NextResponse.json({ processed: newlyAbandoned.length, notified: groups.size, customerReminders, failures });
});