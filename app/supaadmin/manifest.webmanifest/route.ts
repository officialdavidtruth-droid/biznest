import { NextResponse } from "next/server";

// Web app manifest for the SupaAdmin back office, installed as its own app
// (separate from the main BizNest app: own name, icon, start URL and scope).
//
// Reached at /supaadmin/manifest.webmanifest. Browsers fetch the manifest and
// its icons WITHOUT the admin PIN cookie, so middleware.ts explicitly lets this
// path (plus /supaadmin/sw.js and /supaadmin/pwa/*) through the PIN gate. They
// contain nothing sensitive; every actual admin page stays behind the PIN.
export const dynamic = "force-static";

export function GET() {
  const icon = (size: number, purpose: "any" | "maskable") => ({
    src: `/supaadmin/pwa/${purpose === "maskable" ? "icon-maskable" : "icon"}-${size}.png`,
    sizes: `${size}x${size}`,
    type: "image/png",
    purpose,
  });

  const manifest = {
    id: "/supaadmin",
    name: "SupaAdmin — BizNest Platform",
    short_name: "SupaAdmin",
    description: "BizNest platform back office: stores, payouts, disputes and system health.",
    // No trailing slash and no redirect: a start_url that redirects outside the
    // scope would open the installed app with a browser bar.
    start_url: "/supaadmin?source=pwa",
    scope: "/supaadmin/",
    display: "standalone",
    orientation: "portrait",
    theme_color: "#07180f",
    background_color: "#07180f",
    lang: "en-NG",
    dir: "ltr",
    categories: ["business", "productivity"],
    icons: [icon(192, "any"), icon(512, "any"), icon(192, "maskable"), icon(512, "maskable")],
    shortcuts: [
      { name: "Stores", short_name: "Stores", url: "/supaadmin/stores", icons: [{ src: "/supaadmin/pwa/icon-192.png", sizes: "192x192" }] },
      { name: "Payouts", short_name: "Payouts", url: "/supaadmin/payouts", icons: [{ src: "/supaadmin/pwa/icon-192.png", sizes: "192x192" }] },
      { name: "Disputes", short_name: "Disputes", url: "/supaadmin/disputes", icons: [{ src: "/supaadmin/pwa/icon-192.png", sizes: "192x192" }] },
    ],
  };

  return new NextResponse(JSON.stringify(manifest), {
    headers: {
      "Content-Type": "application/manifest+json; charset=utf-8",
      "Cache-Control": "public, max-age=0, s-maxage=3600, stale-while-revalidate=86400",
    },
  });
}
