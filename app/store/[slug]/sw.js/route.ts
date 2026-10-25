import { NextResponse } from "next/server";

// Minimal service worker for an installed store app. Reached at
// /<slug>/sw.js (scope /<slug>/) on the platform host and /sw.js on a custom
// domain (middleware rewrites the latter onto this store, so the platform's
// own public/sw.js is not reachable there). Deliberately no caching: storefront
// prices/stock/orders must never be stale. The pass-through fetch handler just
// keeps browsers that want one for installability happy.
const SW = `self.addEventListener("install", () => self.skipWaiting());
self.addEventListener("activate", (e) => e.waitUntil(self.clients.claim()));
self.addEventListener("fetch", () => {});
`;

export function GET() {
  return new NextResponse(SW, {
    headers: {
      "Content-Type": "application/javascript; charset=utf-8",
      "Cache-Control": "public, max-age=0, must-revalidate",
    },
  });
}
