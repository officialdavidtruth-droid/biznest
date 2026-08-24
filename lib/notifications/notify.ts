import { prisma } from "@/lib/prisma";
import { sendPushToUser } from "@/lib/push/send";
import { sendOrderConfirmationEmail } from "@/lib/email/send";
import { logError } from "@/lib/observability/log";

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

/**
 * Order-confirmation receipt for the buyer, fired the moment an order
 * actually flips to PAID (same trigger point as notifyStoreOwnerOfPaidOrder
 * above, called alongside it from the payment webhooks). Sent to the email
 * the buyer signed up with in the store (User.email), not a POS walk-in
 * name/phone -- POS sales have no email to send to and skip silently.
 * Best-effort: a failed send shouldn't affect the payment flow, so this
 * never throws back to its caller.
 */
export async function notifyCustomerOfPaidOrder(orderId: string): Promise<void> {
  const order = await prisma.order.findUnique({
    where: { id: orderId },
    include: {
      buyer: true,
      store: true,
      items: {
        include: {
          product: { select: { name: true } },
          variant: { select: { label: true } },
          service: { select: { name: true } },
        },
      },
    },
  });
  if (!order) return;

  const email = order.buyer.email;
  if (!email) return;

  try {
    await sendOrderConfirmationEmail(email, {
      id: order.id,
      storeName: order.store.name,
      storeSlug: order.store.slug,
      currency: order.currency,
      subtotal: Number(order.subtotal),
      deliveryFee: Number(order.deliveryFee),
      total: Number(order.total),
      createdAt: order.createdAt,
      items: order.items.map((item) => ({
        name: item.product?.name ?? item.service?.name ?? "Item",
        quantity: item.quantity,
        unitPrice: Number(item.unitPrice),
        variantLabel: item.variant?.label,
      })),
    });
  } catch (err) {
    void logError("EMAIL", "Order confirmation send failed", {
      orderId,
      to: email,
      error: err instanceof Error ? err.message : String(err),
    });
  }
      }
