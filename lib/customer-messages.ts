/**
 * Wording for automatic customer messages (WhatsApp / SMS). Pure functions so
 * the copy is easy to test and review. Every message names the STORE, never
 * the platform, and stays short enough for a single SMS segment where it can.
 */

export type MessageStore = { name: string };

/** Order status -> customer-facing sentence, or null when that status shouldn't send a message. */
export function orderStatusText(
  status: string,
  ctx: { storeName: string; orderNo: string; trackingUrl?: string | null; deliveryStatus?: string | null }
): string | null {
  const { storeName: s, orderNo: n } = ctx;
  const track = ctx.trackingUrl ? ` Track it: ${ctx.trackingUrl}` : "";
  switch (status) {
    case "PAID":
      return `Payment received for order #${n}. ${s} will start on it shortly.`;
    case "IN_PROGRESS":
      return `${s} is preparing your order #${n}.`;
    case "DELIVERED":
      return ctx.deliveryStatus === "OUT_FOR_DELIVERY"
        ? `Your order #${n} from ${s} is on its way.${track}`
        : `Your order #${n} from ${s} is ready.${track}`;
    case "COMPLETED":
      return `Your order #${n} from ${s} is complete. Thank you for shopping with us!`;
    case "CANCELLED":
      return `Your order #${n} from ${s} was cancelled. Contact the store if this wasn't expected.`;
    default:
      return null;
  }
}

/** Delivery milestone -> sentence (sent when the merchant records rider/tracking details). */
export function deliveryUpdateText(
  deliveryStatus: string,
  ctx: { storeName: string; orderNo: string; trackingUrl?: string | null; riderName?: string | null; riderPhone?: string | null }
): string | null {
  const track = ctx.trackingUrl ? ` Track it: ${ctx.trackingUrl}` : "";
  const rider = ctx.riderName
    ? ` Rider: ${ctx.riderName}${ctx.riderPhone ? ` (${ctx.riderPhone})` : ""}.`
    : ctx.riderPhone
      ? ` Rider: ${ctx.riderPhone}.`
      : "";
  switch (deliveryStatus) {
    case "BOOKED":
      return `${ctx.storeName} has arranged delivery for order #${ctx.orderNo}.${rider}${track}`;
    case "PICKED_UP":
      return `Your order #${ctx.orderNo} from ${ctx.storeName} has been picked up by the rider.${rider}${track}`;
    case "OUT_FOR_DELIVERY":
      return `Your order #${ctx.orderNo} from ${ctx.storeName} is out for delivery.${rider}${track}`;
    case "DELIVERED":
      return `Your order #${ctx.orderNo} from ${ctx.storeName} was delivered. Enjoy!`;
    case "FAILED":
      return `We couldn't complete the delivery of order #${ctx.orderNo} from ${ctx.storeName}. The store will contact you.`;
    default:
      return null;
  }
}

export function abandonedCartText(ctx: { storeName: string; itemLabel: string; cartUrl: string }): string {
  return `You left ${ctx.itemLabel} in your cart at ${ctx.storeName}. Complete your order here: ${ctx.cartUrl}`;
}

export function reviewRequestText(ctx: { storeName: string; reviewUrl: string; kind: "order" | "booking" }): string {
  return ctx.kind === "booking"
    ? `Thanks for visiting ${ctx.storeName}! How was it? Leave a quick review: ${ctx.reviewUrl}`
    : `How was your order from ${ctx.storeName}? Leave a quick review: ${ctx.reviewUrl}`;
}

/** Short order number shown to customers and merchants alike (matches the admin order page). */
export function orderNumber(orderId: string): string {
  return orderId.slice(-8).toUpperCase();
}
