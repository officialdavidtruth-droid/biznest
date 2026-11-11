"use server";

import { prisma } from "@/lib/prisma";
import { auth } from "@/lib/auth";
import webpush from "web-push";
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

/**
 * Sends a test push to every device the signed-in user has subscribed and
 * reports what really happened per device, so a failure (mismatched VAPID
 * keys, expired subscription, missing config) is visible instead of silent.
 */
export async function sendTestPush(): Promise<ActionResult<{ message: string }>> {
  const session = await auth();
  if (!session?.user?.id) return { success: false, error: "Not signed in." };

  const publicKey = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY;
  const privateKey = process.env.VAPID_PRIVATE_KEY;
  if (!publicKey || !privateKey) {
    return { success: false, error: "Push keys are missing on the server (NEXT_PUBLIC_VAPID_PUBLIC_KEY / VAPID_PRIVATE_KEY)." };
  }

  const subs = await prisma.pushSubscription.findMany({ where: { userId: session.user.id } });
  if (subs.length === 0) {
    return { success: false, error: "No device is subscribed yet. Tap Enable on this phone first." };
  }

  try {
    webpush.setVapidDetails(process.env.VAPID_SUBJECT ?? "mailto:support@biznest.space", publicKey, privateKey);
  } catch (err) {
    return { success: false, error: `The push keys are invalid: ${err instanceof Error ? err.message : String(err)}` };
  }

  let sent = 0;
  const problems: string[] = [];
  for (const sub of subs) {
    try {
      await webpush.sendNotification(
        { endpoint: sub.endpoint, keys: { p256dh: sub.p256dh, auth: sub.auth } },
        JSON.stringify({ title: "BizNest test", body: "Notifications are working on this device.", url: "/" })
      );
      sent++;
    } catch (err) {
      const status = (err as { statusCode?: number }).statusCode;
      const body = String((err as { body?: unknown }).body ?? "").slice(0, 200);
      if (status === 404 || status === 410 || (status === 400 && /VapidPkHashMismatch/i.test(body))) {
        await prisma.pushSubscription.delete({ where: { id: sub.id } }).catch(() => {});
        problems.push("This device was subscribed with an old key and was removed. Tap Send test again to re-subscribe.");
      } else if (status === 401 || status === 403) {
        problems.push(`The push service rejected the keys (${status}). The public and private VAPID keys probably don't match.`);
      } else {
        problems.push(`Send failed${status ? ` (${status})` : ""}: ${body || (err instanceof Error ? err.message : String(err))}`);
      }
    }
  }

  if (sent === 0) return { success: false, error: problems.join(" ") };
  return { success: true, data: { message: `Sent to ${sent} of ${subs.length} device(s).${problems.length ? " " + problems.join(" ") : ""}` } };
}
