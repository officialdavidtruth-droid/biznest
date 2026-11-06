import "server-only";
import { after } from "next/server";
import { prisma } from "@/lib/prisma";
import { sendPushToUser } from "@/lib/push/send";
import { logError } from "@/lib/observability/log";

/** Notification types written for Browse followers. */
export const BROWSE_NOTIFY_TYPES = ["BROWSE_POST", "BROWSE_STORY"] as const;
/** One alert per follower per business per this window, so a busy shop doesn't flood anyone. */
export const BROWSE_NOTIFY_WINDOW_MS = 12 * 60 * 60 * 1000;
/** Followers alerted per publish. Bigger audiences still see the post in their Following feed. */
export const BROWSE_NOTIFY_MAX_FOLLOWERS = 2000;

type Target = { storeId: string; storeName: string; storeSlug: string };

const snippet = (s: string, n: number) => { const t = s.replace(/\s+/g, " ").trim(); return t.length > n ? `${t.slice(0, n - 1)}…` : t; };

/** Runs after the response is sent when possible, and never lets a failure reach the person who posted. */
function background(job: () => Promise<void>) {
  const run = () => job().catch((err: unknown) => { void logError("MESSAGING", "Follower notification failed", { message: err instanceof Error ? err.message : String(err) }); });
  try { after(run); } catch { void run(); }
}

async function fanOut(t: Target, type: (typeof BROWSE_NOTIFY_TYPES)[number], body: string, url: string): Promise<number> {
  const rows = await prisma.browseFollow.findMany({
    where: { storeId: t.storeId, viewerKey: { startsWith: "u:" } },
    orderBy: { createdAt: "desc" },
    take: BROWSE_NOTIFY_MAX_FOLLOWERS,
    select: { viewerKey: true },
  });
  const userIds = rows.map((r: { viewerKey: string }) => r.viewerKey.slice(2)).filter(Boolean);
  if (userIds.length === 0) return 0;

  // Skip anyone already alerted about this business recently.
  const recent = await prisma.notification.findMany({
    where: { userId: { in: userIds }, type: { in: [...BROWSE_NOTIFY_TYPES] }, title: t.storeName, createdAt: { gte: new Date(Date.now() - BROWSE_NOTIFY_WINDOW_MS) } },
    select: { userId: true },
  });
  const skip = new Set(recent.map((r: { userId: string }) => r.userId));
  const targets = userIds.filter((id: string) => !skip.has(id));
  if (targets.length === 0) return 0;

  await prisma.notification.createMany({ data: targets.map((userId: string) => ({ userId, type, title: t.storeName, body, url })) });

  const subs = await prisma.pushSubscription.findMany({ where: { userId: { in: targets } }, select: { userId: true }, distinct: ["userId"] });
  const pushIds = subs.map((s: { userId: string }) => s.userId);
  for (let i = 0; i < pushIds.length; i += 10) {
    await Promise.all(pushIds.slice(i, i + 10).map((userId: string) => sendPushToUser(userId, { title: t.storeName, body, url, tag: `browse-${t.storeSlug}` }).catch(() => undefined)));
  }
  return targets.length;
}

export function notifyFollowersOfPost(t: Target & { postId: string; caption: string; productName?: string | null }) {
  const body = t.productName ? `New: ${snippet(t.productName, 80)}` : t.caption ? snippet(t.caption, 100) : "Shared a new post";
  background(async () => { await fanOut(t, "BROWSE_POST", body, `/browse/p/${t.postId}`); });
}

export function notifyFollowersOfStory(t: Target) {
  background(async () => { await fanOut(t, "BROWSE_STORY", "Added a new story", `/browse/s/${t.storeSlug}`); });
}
