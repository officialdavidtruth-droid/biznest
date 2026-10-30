import { NextResponse } from "next/server";

// Service worker for the installed SupaAdmin app (scope /supaadmin/, which is
// the script's own directory, so no Service-Worker-Allowed header is needed).
//
// Deliberately NO caching: this is a live back office (payouts, disputes,
// verification queue). Showing a stale page here would be worse than showing
// nothing. The pass-through fetch handler exists so browsers treat the app as
// installable; it never touches a response.
export const dynamic = "force-static";

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
