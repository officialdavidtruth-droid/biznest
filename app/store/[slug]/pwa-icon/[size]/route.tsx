import { ImageResponse } from "next/og";
import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { safeHex } from "@/lib/store-pwa";

// Square PNG home-screen icon for a store. Browsers need a real PNG at
// 192/512 to treat a site as installable, but a vendor's logo can be any size
// or format, so we fetch it, centre it on white inside the maskable safe zone,
// and re-render it as PNG. No logo (or an unsupported format such as WebP)
// falls back to a brand-coloured tile with the store's first letter.
export const dynamic = "force-dynamic";

const ALLOWED_SIZES = new Set([180, 192, 512]);
const OK_TYPES = new Set(["image/png", "image/jpeg", "image/gif", "image/svg+xml"]);
const MAX_LOGO_BYTES = 2 * 1024 * 1024;

// The logo URL is vendor-controlled and fetched server-side, so only allow
// public https hosts: no http, IP literals, localhost or internal names, and
// no redirects (a redirect could point somewhere internal).
function isPublicHttpsHost(u: URL): boolean {
  if (u.protocol !== "https:") return false;
  const h = u.hostname.toLowerCase();
  if (h === "localhost" || h.endsWith(".localhost") || h.endsWith(".local") || h.endsWith(".internal")) return false;
  if (/^[\d.]+$/.test(h) || h.includes(":")) return false; // IPv4 / IPv6 literal
  return h.includes(".");
}

async function logoDataUri(logoUrl: string, origin: string): Promise<string | null> {
  try {
    const target = new URL(logoUrl, origin);
    if (target.origin !== origin && !isPublicHttpsHost(target)) return null;
    const res = await fetch(target, { signal: AbortSignal.timeout(4000), redirect: "manual" });
    if (!res.ok) return null;
    const type = (res.headers.get("content-type") ?? "").split(";")[0].trim().toLowerCase();
    if (!OK_TYPES.has(type)) return null;
    const buf = await res.arrayBuffer();
    if (buf.byteLength === 0 || buf.byteLength > MAX_LOGO_BYTES) return null;
    return `data:${type};base64,${Buffer.from(buf).toString("base64")}`;
  } catch {
    return null;
  }
}

export async function GET(request: Request, { params }: { params: Promise<{ slug: string; size: string }> }) {
  const { slug, size: sizeParam } = await params;
  const size = Number.parseInt(sizeParam, 10);
  if (!ALLOWED_SIZES.has(size)) return new NextResponse("Not found", { status: 404 });

  const store = await prisma.store.findUnique({
    where: { slug },
    select: { name: true, logoUrl: true, themeColors: true },
  });
  if (!store) return new NextResponse("Not found", { status: 404 });

  const primary = safeHex((store.themeColors as { primary?: string } | null)?.primary, "#0f6410");
  const dataUri = store.logoUrl ? await logoDataUri(store.logoUrl, new URL(request.url).origin) : null;
  const inner = Math.round(size * 0.72); // inside the 80% maskable safe zone
  const initial = (store.name.trim().charAt(0) || "S").toUpperCase();

  const image = new ImageResponse(
    dataUri ? (
      <div style={{ width: "100%", height: "100%", display: "flex", alignItems: "center", justifyContent: "center", background: "#ffffff" }}>
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={dataUri} width={inner} height={inner} style={{ objectFit: "contain" }} alt="" />
      </div>
    ) : (
      <div style={{ width: "100%", height: "100%", display: "flex", alignItems: "center", justifyContent: "center", background: primary, color: "#ffffff", fontSize: Math.round(size * 0.5), fontWeight: 700 }}>
        {initial}
      </div>
    ),
    { width: size, height: size }
  );

  image.headers.set("Cache-Control", "public, max-age=0, s-maxage=86400, stale-while-revalidate=604800");
  return image;
}
