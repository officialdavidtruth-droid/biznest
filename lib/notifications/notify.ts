import { prisma } from "@/lib/prisma";
import { sendPushToUser } from "@/lib/push/send";

type NotifyInput = {
  userId: string;
  type: string; // "ORDER_PAID" | "ABANDONED_CHECKOUT" | "MESSAGE" | "VERIFICATION" | ...
  title: string;
  body: string;
  url?: string;
};

/**
 * Single entry point for notifying a merchant of something that happened in
 * their store. Always writes a Notification row first (shows up in the
 * dashboard bell -- works even if the merchant's connection is too spotty
 * for the push itself, or they simply haven't granted push permission),
 * then best-effort pushes to any subscribed devices on top. Callers should
 * fire-and-forget this (`void notifyUser(...)`) from webhooks/cron routes
 * so a slow push provider never blocks the response.
 */
export async function notifyUser(input: NotifyInput): Promise<void> {
  await prisma.notification.create({
    data: { userId: input.userId, type: input.type, title: input.title, body: input.body, url: input.url },
  });

  await sendPushToUser(input.userId, { title: input.title, body: input.body, url: input.url });
}

/**
 * Convenience wrapper for the single most time-sensitive merchant alert on
 * the platform: money landing. Resolves storeId -> the store owner's
 * userId so payment webhooks don't each need to duplicate that lookup.
 */
export async function notifyStoreOwnerOfPaidOrder(
  storeId: string,
  orderId: string,
  amount: number,
  currency: string
): Promise<void> {
  const store = await prisma.store.findUnique({ where: { id: storeId }, include: { business: true } });
  if (!store) return;

  await notifyUser({
    userId: store.business.userId,
    type: "ORDER_PAID",
    title: "New order paid 🎉",
    body: `${currency} ${amount.toLocaleString()} just came in on ${store.name}.`,
    url: `/${store.slug}/admin/orders/${orderId}`,
  });
}
