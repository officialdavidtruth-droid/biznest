import "server-only";
import { prisma } from "@/lib/prisma";
import { messageCustomer, type CustomerMessageOutcome } from "@/lib/customer-messaging";
import { deliveryUpdateText, orderNumber, orderStatusText } from "@/lib/customer-messages";
import { logError, errorMeta } from "@/lib/observability/log";

const orderSelect = {
  id: true,
  status: true,
  channel: true,
  shippingAddress: true,
  deliveryStatus: true,
  trackingUrl: true,
  riderName: true,
  riderPhone: true,
  buyer: { select: { name: true } },
  store: { select: { name: true, msgOrderUpdates: true } },
} as const;

type ShipTo = { fullName?: string; phone?: string } | null;

/**
 * WhatsApp/SMS the customer when their order changes status. Runs only if the store switched
 * "order updates" on. Skips POS sales (the customer is standing in the shop). Never throws.
 */
export async function messageOrderStatus(orderId: string, status: string): Promise<CustomerMessageOutcome | null> {
  try {
    const order = await prisma.order.findUnique({ where: { id: orderId }, select: orderSelect });
    if (!order || !order.store.msgOrderUpdates || order.channel === "POS") return null;
    const text = orderStatusText(status, {
      storeName: order.store.name,
      orderNo: orderNumber(order.id),
      trackingUrl: order.trackingUrl,
      deliveryStatus: order.deliveryStatus,
    });
    if (!text) return null;
    const ship = order.shippingAddress as ShipTo;
    return await messageCustomer({
      phone: ship?.phone,
      firstName: ship?.fullName ?? order.buyer.name,
      storeName: order.store.name,
      text,
      dedupeKey: `order:${order.id}`,
    });
  } catch (err) {
    void logError("MESSAGING", "Order status message failed", errorMeta(err, { orderId }));
    return null;
  }
}

/** Tells the customer about a delivery milestone (rider booked, out for delivery, delivered...). Never throws. */
export async function messageDeliveryUpdate(orderId: string): Promise<CustomerMessageOutcome | null> {
  try {
    const order = await prisma.order.findUnique({ where: { id: orderId }, select: orderSelect });
    if (!order || !order.store.msgOrderUpdates || order.channel === "POS" || !order.deliveryStatus) return null;
    const text = deliveryUpdateText(order.deliveryStatus, {
      storeName: order.store.name,
      orderNo: orderNumber(order.id),
      trackingUrl: order.trackingUrl,
      riderName: order.riderName,
      riderPhone: order.riderPhone,
    });
    if (!text) return null;
    const ship = order.shippingAddress as ShipTo;
    return await messageCustomer({
      phone: ship?.phone,
      firstName: ship?.fullName ?? order.buyer.name,
      storeName: order.store.name,
      text,
      dedupeKey: `order:${order.id}`,
      perHour: 8,
    });
  } catch (err) {
    void logError("MESSAGING", "Delivery update message failed", errorMeta(err, { orderId }));
    return null;
  }
}
