"use server";

import { prisma } from "@/lib/prisma";
import { auth } from "@/lib/auth";
import type { ActionResult } from "@/types/actions";

type SubscriptionInput = {
  endpoint: string;
  keys: { p256dh: string; auth: string };
  userAgent?: string;
};

/**
 * Registers this browser/device to receive push notifications for the
 * signed-in user. Called from components/dashboard/push-subscribe-prompt.tsx
 * right after the service worker's PushManager.subscribe() resolves.
 * Upserts on endpoint (unique) so re-subscribing the same device (e.g.
 * after clearing site data) doesn't create a duplicate row.
 */
export async function subscribeToPush(sub: SubscriptionInput): Promise<ActionResult> {
  const session = await auth();
  if (!session?.user?.id) return { success: false, error: "Not signed in." };

  await prisma.pushSubscription.upsert({
    where: { endpoint: sub.endpoint },
    create: {
      userId: session.user.id,
      endpoint: sub.endpoint,
      p256dh: sub.keys.p256dh,
      auth: sub.keys.auth,
      userAgent: sub.userAgent,
    },
    update: { userId: session.user.id, p256dh: sub.keys.p256dh, auth: sub.keys.auth },
  });

  return { success: true, data: undefined };
}

export async function unsubscribeFromPush(endpoint: string): Promise<ActionResult> {
  const session = await auth();
  if (!session?.user?.id) return { success: false, error: "Not signed in." };

  await prisma.pushSubscription.deleteMany({ where: { endpoint, userId: session.user.id } });
  return { success: true, data: undefined };
}

/** For the bell/menu: has this user granted push on ANY device? */
export async function hasActivePushSubscription(): Promise<boolean> {
  const session = await auth();
  if (!session?.user?.id) return false;
  const count = await prisma.pushSubscription.count({ where: { userId: session.user.id } });
  return count > 0;
}
