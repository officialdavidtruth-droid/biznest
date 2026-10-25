import { NextResponse } from "next/server";

// Service worker for an installed store app. Reached at /<slug>/sw.js (scope
// /<slug>/) on the platform host and /sw.js on a custom domain (middleware
// rewrites the latter onto this store, so the platform's own public/sw.js is
// not reachable there).
//
// Deliberately no caching: storefront prices/stock/orders must never be stale.
// The pass-through fetch handler just keeps browsers that want one for
// installability happy. Its only other job is delivering order-update pushes
// to signed-in customers (see lib/push/send.ts -> sendPushToStoreCustomer).
//
// Push payload urls are STORE-RELATIVE ("/orders/<id>") and are resolved
// against this worker's scope, so the same script works for both
// biznest.space/<slug> and a custom domain without the server knowing which.
const SW = `self.addEventListener("install", () => self.skipWaiting());
self.addEventListener("activate", (e) => e.waitUntil(self.clients.claim()));
self.addEventListener("fetch", () => {});

function resolveUrl(path) {
  try {
    const rel = String(path || "").replace(/^\\/+/, "");
    const target = new URL(rel, self.registration.scope);
    // Never navigate off the store's own origin.
    return target.origin === self.location.origin ? target.href : self.registration.scope;
  } catch {
    return self.registration.scope;
  }
}

self.addEventListener("push", (event) => {
  if (!event.data) return;
  let payload;
  try {
    payload = event.data.json();
  } catch {
    payload = { title: "Order update", body: event.data.text() };
  }
  event.waitUntil(
    self.registration.showNotification(payload.title || "Order update", {
      body: payload.body || "",
      icon: payload.icon || undefined,
      tag: payload.tag || undefined,
      data: { url: resolveUrl(payload.url) },
      vibrate: [200, 100, 200],
    })
  );
});

self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  const url = event.notification.data && event.notification.data.url;
  event.waitUntil(
    self.clients.matchAll({ type: "window", includeUncontrolled: true }).then((clients) => {
      for (const client of clients) {
        if (client.url === url && "focus" in client) return client.focus();
      }
      if (clients.length > 0 && "navigate" in clients[0]) {
        return clients[0].navigate(url).then((c) => (c || clients[0]).focus());
      }
      return self.clients.openWindow(url);
    })
  );
});
`;

export function GET() {
  return new NextResponse(SW, {
    headers: {
      "Content-Type": "application/javascript; charset=utf-8",
      "Cache-Control": "public, max-age=0, must-revalidate",
    },
  });
}
