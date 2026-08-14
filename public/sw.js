// BizNest dashboard service worker — push notifications + PWA installability.
// Deliberately NOT a full offline/asset-caching worker (no fetch handler,
// no precaching): the dashboard is server-rendered and data-heavy, so
// caching stale storefront/order data would be actively misleading for a
// merchant on flaky mobile data. This worker's only job is push delivery.

self.addEventListener("install", () => {
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(self.clients.claim());
});

self.addEventListener("push", (event) => {
  if (!event.data) return;

  let payload;
  try {
    payload = event.data.json();
  } catch {
    payload = { title: "BizNest", body: event.data.text() };
  }

  const { title, body, url } = payload;

  event.waitUntil(
    self.registration.showNotification(title || "BizNest", {
      body: body || "",
      icon: "/icon-192.png",
      badge: "/icon-192.png",
      data: { url: url || "/" },
      // Vibration pattern matters on the exact devices this is built for —
      // a Nigerian merchant's Android phone, likely on data-saver / low
      // brightness, where a silent notification is easy to miss.
      vibrate: [200, 100, 200],
    })
  );
});

self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  const url = event.notification.data?.url || "/";

  event.waitUntil(
    self.clients.matchAll({ type: "window", includeUncontrolled: true }).then((clients) => {
      for (const client of clients) {
        if (client.url.includes(url) && "focus" in client) return client.focus();
      }
      if (clients.length > 0 && "focus" in clients[0]) {
        clients[0].navigate(url);
        return clients[0].focus();
      }
      return self.clients.openWindow(url);
    })
  );
});
