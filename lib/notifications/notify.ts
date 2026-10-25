import { prisma } from "@/lib/prisma";
import { sendPushToUser } from "@/lib/push/send";
import { sendOrderConfirmationEmail, storeEmailBrand } from "@/lib/email/send";
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
    url: `/store/${store.slug}/admin/orders/${orderId}`,
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
      storeLogoUrl: order.store.logoUrl,
      storeColor: storeEmailBrand(order.store).color,
      storeContactEmail: order.store.contactEmail,
      storeContactPhone: order.store.contactPhone,
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

const CUSTOMER_ORDER_PUSH: Record<string, { title: string; body: (store: string) => string }> = {
  PAID: { title: "Payment received", body: (s) => `${s} has received your payment and will start on your order.` },
  IN_PROGRESS: { title: "Your order is being prepared", body: (s) => `${s} is working on your order now.` },
  DELIVERED: { title: "Your order is ready", body: (s) => `Your order from ${s} is ready.` },
  COMPLETED: { title: "Order completed", body: (s) => `Your order from ${s} is complete. Thanks for shopping!` },
  CANCELLED: { title: "Order cancelled", body: (s) => `Your order from ${s} was cancelled.` },
  REFUNDED: { title: "Order refunded", body: (s) => `Your order from ${s} was refunded.` },
};

/**
 * Push to the buyer when their order moves to a new status. Push-only (no
 * Notification row): customers have no in-app bell, and the order page +
 * email remain the source of truth. The url is store-relative; the store's
 * service worker resolves it against its own scope (biznest.space/<slug> or
 * a custom domain). Never throws -- it must not break a status update.
 */
export async function notifyCustomerOfOrderStatus(orderId: string, status: string): Promise<void> {
  try {
    const copy = CUSTOMER_ORDER_PUSH[status];
    if (!copy) return;
    const order = await prisma.order.findUnique({
      where: { id: orderId },
      select: { id: true, buyerId: true, store: { select: { name: true } } },
    });
    if (!order) return;
    await sendPushToUser(order.buyerId, {
      title: copy.title,
      body: copy.body(order.store.name),
      url: `/orders/${order.id}`,
      tag: `order-${order.id}`,
    });
  } catch (err) {
    void logError("MESSAGING", "Customer order push failed", { orderId, error: err instanceof Error ? err.message : String(err) });
  }
}
