"use server";

import { prisma } from "@/lib/prisma";
import { requireStoreCustomer } from "@/lib/actions/store-customer";
import type { ActionResult } from "@/types/actions";

type SubscriptionInput = {
  endpoint: string;
  keys: { p256dh: string; auth: string };
  userAgent?: string;
};

/**
 * Registers this device for order-update pushes for the signed-in customer of
 * `storeSlug`. Store customers are scoped per store (see
 * lib/store-customer-auth.ts), so the subscription is tied to that scoped
 * customer user and can never receive another store's notifications.
 */
export async function subscribeStoreCustomerToPush(storeSlug: string, sub: SubscriptionInput): Promise<ActionResult> {
  const membership = await requireStoreCustomer(storeSlug);
  if (!membership) return { success: false, error: "Sign in to turn on order notifications." };

  if (!sub?.endpoint?.startsWith("https://") || !sub.keys?.p256dh || !sub.keys?.auth) {
    return { success: false, error: "Invalid subscription." };
  }

  await prisma.pushSubscription.upsert({
    where: { endpoint: sub.endpoint },
    create: {
      userId: membership.userId,
      endpoint: sub.endpoint,
      p256dh: sub.keys.p256dh,
      auth: sub.keys.auth,
      userAgent: sub.userAgent?.slice(0, 500),
    },
    update: { userId: membership.userId, p256dh: sub.keys.p256dh, auth: sub.keys.auth },
  });

  return { success: true, data: undefined };
}

/**
 * Removes this customer's subscription for `endpoint`. `removed` is true only
 * when a row belonging to THIS customer was deleted, so callers can tell a
 * customer subscription apart from e.g. a merchant's on the same browser and
 * leave the latter alone.
 */
export async function unsubscribeStoreCustomerFromPush(
  storeSlug: string,
  endpoint: string
): Promise<ActionResult<{ removed: boolean }>> {
  const membership = await requireStoreCustomer(storeSlug);
  if (!membership) return { success: false, error: "Not signed in." };

  const { count } = await prisma.pushSubscription.deleteMany({ where: { endpoint, userId: membership.userId } });
  return { success: true, data: { removed: count > 0 } };
}
