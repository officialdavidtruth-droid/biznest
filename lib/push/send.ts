import webpush from "web-push";
import { prisma } from "@/lib/prisma";
import { logError, errorMeta } from "@/lib/observability/log";

const VAPID_PUBLIC_KEY = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY;
const VAPID_PRIVATE_KEY = process.env.VAPID_PRIVATE_KEY;
const VAPID_SUBJECT = process.env.VAPID_SUBJECT ?? "mailto:support@biznest.space";

let configured = false;
function ensureConfigured() {
  if (configured) return true;
  if (!VAPID_PUBLIC_KEY || !VAPID_PRIVATE_KEY) return false;
  webpush.setVapidDetails(VAPID_SUBJECT, VAPID_PUBLIC_KEY, VAPID_PRIVATE_KEY);
  configured = true;
  return true;
}

type PushPayload = { title: string; body: string; url?: string };

/**
 * Pushes to every device a user has subscribed from (phone + laptop both
 * get it). Best-effort: a merchant's data connection dropping mid-push, or
 * a subscription going stale, should never surface as an error to whatever
 * triggered the notification (a webhook, a cron run) -- it's already
 * logged to SystemEvent and, more importantly, the same event was already
 * written to the Notification table so it's visible in-app regardless of
 * whether the push itself lands. See lib/notifications/notify.ts, which is
 * the entry point everything else should call rather than this directly.
 */
export async function sendPushToUser(userId: string, payload: PushPayload): Promise<void> {
  if (!ensureConfigured()) return; // not configured on this deployment -- in-app notification still landed

  const subscriptions = await prisma.pushSubscription.findMany({ where: { userId } });
  if (subscriptions.length === 0) return;

  await Promise.all(
    subscriptions.map(async (sub) => {
      try {
        await webpush.sendNotification(
          {
            endpoint: sub.endpoint,
            keys: { p256dh: sub.p256dh, auth: sub.auth },
          },
          JSON.stringify(payload)
        );
      } catch (err) {
        const statusCode = (err as { statusCode?: number }).statusCode;
        if (statusCode === 404 || statusCode === 410) {
          // Subscription expired or was revoked on the device -- prune it
          // rather than retrying it forever.
          await prisma.pushSubscription.delete({ where: { id: sub.id } }).catch(() => {});
          return;
        }
        void logError("MESSAGING", "Push send failed", errorMeta(err, { userId, endpoint: sub.endpoint }));
      }
    })
  );
}
