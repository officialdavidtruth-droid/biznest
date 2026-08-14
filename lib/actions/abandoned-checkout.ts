"use server";

import { prisma } from "@/lib/prisma";
import { revalidatePath } from "next/cache";
import type { ActionResult } from "@/types/actions";
import type { NotificationChannel } from "@prisma/client";
import { assertStoreAccess } from "@/lib/actions/order";
import { ABANDONED_CHECKOUT_THRESHOLD_MINUTES } from "@/lib/constants/order";
import { sendOrderNotificationEmail } from "@/lib/email/send";
import { sendSms } from "@/lib/sms/send";
import { sendWhatsAppMessage } from "@/lib/whatsapp/send";

const APP_URL = process.env.NEXT_PUBLIC_APP_URL ?? "https://biznest.vercel.app";

/**
 * An "abandoned checkout" isn't its own table -- it's any Order still at
 * PENDING_PAYMENT (checkout started, gateway charge never completed) older
 * than the threshold. See lib/constants/order.ts for why this is evaluated
 * at read time rather than a status a cron job flips.
 */
export async function listAbandonedCheckouts(slug: string) {
  const access = await assertStoreAccess(slug);
  if (!access.success) return [];

  const cutoff = new Date(Date.now() - ABANDONED_CHECKOUT_THRESHOLD_MINUTES * 60_000);

  return prisma.order.findMany({
    where: { storeId: access.store.id, status: "PENDING_PAYMENT", createdAt: { lt: cutoff } },
    include: {
      buyer: { select: { name: true, email: true } },
      items: { include: { product: true, service: true } },
      abandonedNotifications: { orderBy: { sentAt: "desc" } },
    },
    orderBy: { createdAt: "desc" },
  });
}

function cartLabel(items: { quantity: number; product: { name: string } | null; service: { name: string } | null }[]) {
  const first = items[0];
  const firstName = first?.product?.name ?? first?.service?.name ?? "an item";
  return items.length > 1 ? `${firstName} and ${items.length - 1} other item${items.length > 2 ? "s" : ""}` : firstName;
}

/**
 * Sends a merchant-triggered "you left something in your cart" nudge for
 * one abandoned order over one channel, and records the attempt so the
 * merchant can see what's already gone out before firing another channel.
 */
export async function sendAbandonedCheckoutRecovery(
  slug: string,
  orderId: string,
  channel: NotificationChannel
): Promise<ActionResult> {
  const access = await assertStoreAccess(slug);
  if (!access.success) return { success: false, error: access.error };

  const order = await prisma.order.findFirst({
    where: { id: orderId, storeId: access.store.id, status: "PENDING_PAYMENT" },
    include: {
      buyer: { select: { name: true, email: true } },
      items: { include: { product: true, service: true } },
    },
  });
  if (!order) return { success: false, error: "That abandoned checkout could not be found." };

  const shipping = order.shippingAddress as { phone?: string; fullName?: string } | null;
  const cartUrl = `${APP_URL}/store/${slug}/cart`;
  const storeName = access.store.name;
  const label = cartLabel(order.items);
  const textMessage = `Hi${shipping?.fullName ? ` ${shipping.fullName.split(" ")[0]}` : ""}, you left ${label} in your ${storeName} cart. Complete your order: ${cartUrl}`;

  let result: { success: boolean; error?: string };

  if (channel === "EMAIL") {
    if (!order.buyer.email) {
      return { success: false, error: "This customer has no email on file." };
    }
    try {
      await sendOrderNotificationEmail(
        order.buyer.email,
        "You left something in your cart",
        `You left <strong>${label}</strong> in your cart at ${storeName}. <a href="${cartUrl}">Complete your order</a> before it sells out.`
      );
      result = { success: true };
    } catch (err) {
      result = { success: false, error: err instanceof Error ? err.message : "Email send failed." };
    }
  } else if (channel === "SMS") {
    if (!shipping?.phone) return { success: false, error: "This customer has no phone number on file." };
    result = await sendSms(shipping.phone, textMessage);
  } else {
    if (!shipping?.phone) return { success: false, error: "This customer has no phone number on file." };
    result = await sendWhatsAppMessage(shipping.phone, {
      templateName: "abandoned_checkout_recovery",
      templateParams: [shipping.fullName?.split(" ")[0] ?? "there", label, storeName],
    });
  }

  await prisma.abandonedCheckoutNotification.create({
    data: {
      orderId: order.id,
      channel,
      status: result.success ? "SENT" : "FAILED",
      error: result.success ? null : result.error,
    },
  });

  revalidatePath(`/store/${slug}/admin/abandoned-checkouts`);

  if (!result.success) return { success: false, error: result.error ?? "Send failed." };
  return { success: true, data: undefined };
}
