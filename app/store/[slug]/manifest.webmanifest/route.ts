import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { logoVersion, safeHex, shortName, storeBasePath } from "@/lib/store-pwa";

// Per-store web app manifest. Reached at /<slug>/manifest.webmanifest on the
// platform host (middleware rewrites it here) and at /manifest.webmanifest on
// a vendor's custom domain. Makes "Install app" / "Add to Home Screen" install
// THIS store with its own name, logo and brand colour.
export const dynamic = "force-dynamic";

export async function GET(request: Request, { params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const store = await prisma.store.findUnique({
    where: { slug },
    select: { name: true, logoUrl: true, themeColors: true, status: true, marketingOnly: true },
  });
  if (!store || store.status !== "ACTIVE" || store.marketingOnly) {
    return new NextResponse("Not found", { status: 404 });
  }

  const base = storeBasePath(request.headers.get("host"), slug);
  const colors = (store.themeColors ?? {}) as { primary?: string; background?: string };
  const v = logoVersion(store.logoUrl);
  const icon = (size: number, purpose: "any" | "maskable") => ({
    src: `${base}/pwa-icon/${size}?v=${v}`,
    sizes: `${size}x${size}`,
    type: "image/png",
    purpose,
  });

  const manifest = {
    id: base || "/",
    name: store.name,
    short_name: shortName(store.name),
    description: `Shop ${store.name} from your phone.`,
    // No trailing slash on the platform host: Next redirects "/<slug>/" to
    // "/<slug>", and a start_url that redirects outside the scope would make the
    // installed app open with a browser bar on its home page.
    start_url: base ? `${base}?source=pwa` : "/?source=pwa",
    scope: base || "/",
    display: "standalone",
    orientation: "portrait",
    theme_color: safeHex(colors.primary, "#0f6410"),
    background_color: "#ffffff",
    lang: "en-NG",
    dir: "ltr",
    categories: ["shopping", "business"],
    icons: [icon(192, "any"), icon(512, "any"), icon(192, "maskable"), icon(512, "maskable")],
  };

  return new NextResponse(JSON.stringify(manifest), {
    headers: {
      "Content-Type": "application/manifest+json; charset=utf-8",
      "Cache-Control": "public, max-age=0, s-maxage=3600, stale-while-revalidate=86400",
    },
  });
}
