"use server";

import { prisma } from "@/lib/prisma";
import { revalidatePath } from "next/cache";
import { assertStoreAccess } from "@/lib/actions/order";
import { cleanTrackingUrl, isDeliveryStatus, type DeliveryStatus } from "@/lib/delivery";
import { messageDeliveryUpdate } from "@/lib/order-messaging";
import type { ActionResult } from "@/types/actions";

export type OrderDeliveryInput = {
  status: DeliveryStatus;
  trackingUrl?: string;
  riderName?: string;
  riderPhone?: string;
  /** Message the customer about this update (only does anything if the store turned order updates on). */
  notifyCustomer?: boolean;
};

/**
 * Records last-mile delivery details on an order (rider, tracking link, status) and, if the store has
 * customer messages switched on, tells the customer. Product orders that are paid and not yet closed only.
 */
export async function saveOrderDelivery(
  slug: string,
  orderId: string,
  input: OrderDeliveryInput
): Promise<ActionResult<{ messaged: boolean }>> {
  const access = await assertStoreAccess(slug);
  if (!access.success) return { success: false, error: access.error };

  if (!isDeliveryStatus(input.status)) return { success: false, error: "Choose a valid delivery status." };

  const trackingRaw = (input.trackingUrl ?? "").trim();
  const trackingUrl = cleanTrackingUrl(trackingRaw);
  if (trackingRaw && !trackingUrl) return { success: false, error: "The tracking link must start with http:// or https://." };

  const riderName = (input.riderName ?? "").trim().slice(0, 80) || null;
  const riderPhone = (input.riderPhone ?? "").trim().slice(0, 30) || null;

  const order = await prisma.order.findFirst({
    where: { id: orderId, storeId: access.store.id },
    select: { id: true, status: true, channel: true, deliveryStatus: true, trackingUrl: true },
  });
  if (!order) return { success: false, error: "Order not found." };
  if (order.channel === "POS") return { success: false, error: "In-store sales don't have a delivery." };
  if (!["PAID", "IN_PROGRESS", "DELIVERED"].includes(order.status)) {
    return { success: false, error: "Delivery can only be recorded for a paid order that isn't completed, cancelled or refunded." };
  }

  await prisma.order.update({
    where: { id: order.id },
    data: { deliveryProvider: "MANUAL", deliveryStatus: input.status, trackingUrl, riderName, riderPhone },
  });

  const changed = order.deliveryStatus !== input.status || order.trackingUrl !== trackingUrl;
  let messaged = false;
  if (input.notifyCustomer !== false && changed) {
    const outcome = await messageDeliveryUpdate(order.id);
    messaged = !!outcome?.sent;
  }

  revalidatePath(`/store/${slug}/admin/orders/${order.id}`);
  revalidatePath(`/store/${slug}/orders`);
  return { success: true, data: { messaged } };
}
