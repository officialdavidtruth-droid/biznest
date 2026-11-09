"use client";

/**
 * Fire-and-forget Browse analytics for the seller's Insights page. Post impressions are queued and sent
 * together; each post counts once per page load.
 */
type Payload = { kind: "PROFILE_VIEW"; slug: string } | { kind: "SHARE"; slug?: string; postId?: string } | { kind: "SHOP_TAP"; postId: string };

function send(body: unknown) {
  try {
    const data = JSON.stringify(body);
    if (navigator.sendBeacon) {
      navigator.sendBeacon("/api/browse/track", new Blob([data], { type: "application/json" }));
    } else {
      void fetch("/api/browse/track", { method: "POST", headers: { "content-type": "application/json" }, body: data, keepalive: true });
    }
  } catch {
    /* analytics never breaks the page */
  }
}

export function trackBrowse(payload: Payload) {
  send(payload);
}

const seen = new Set<string>();
let queue: string[] = [];
let timer: ReturnType<typeof setTimeout> | null = null;

function flush() {
  timer = null;
  const ids = queue.slice(0, 20);
  queue = queue.slice(20);
  if (ids.length) send({ kind: "POST_IMPRESSION", postIds: ids });
  if (queue.length) timer = setTimeout(flush, 2000);
}

export function trackImpression(postId: string) {
  if (seen.has(postId)) return;
  seen.add(postId);
  queue.push(postId);
  if (!timer) timer = setTimeout(flush, 2000);
}
