import { RESERVED_SLUGS } from "@/lib/constants/reserved-slugs";

export type PageArea = "Seller dashboard" | "Storefront" | "Platform pages";

const CUID = /^c[a-z0-9]{20,}$/;
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function looksLikeId(seg: string): boolean {
  return CUID.test(seg) || UUID.test(seg) || /^\d+$/.test(seg) || (seg.length >= 20 && /\d/.test(seg));
}

/** Paths that are never counted: back office, API, framework and files. */
export function isTrackablePath(path: string): boolean {
  if (!path.startsWith("/") || path.length > 300) return false;
  if (/^\/(supaadmin|api|_next)(\/|$)/.test(path)) return false;
  return !/\.[a-z0-9]{2,5}$/i.test(path);
}

/**
 * Turns a real URL path into a page name that groups alike pages together:
 * store addresses become [store], record ids become [id], and product/post addresses become [item].
 */
export function classifyPagePath(rawPath: string, onPlatformHost = true): { path: string; area: PageArea } | null {
  const clean = rawPath.split("?")[0].split("#")[0].replace(/\/+$/, "") || "/";
  if (!isTrackablePath(clean)) return null;
  let segs = clean.split("/").filter(Boolean);
  if (!segs.length) return { path: "/", area: "Platform pages" };

  let isStore = !onPlatformHost;
  if (onPlatformHost) {
    if (segs[0] === "store" && segs.length > 1) {
      segs = segs.slice(1); // /store/<slug>/... is the same store as /<slug>/...
      isStore = true;
    } else if (!RESERVED_SLUGS.has(segs[0].toLowerCase())) {
      isStore = true;
    }
  }

  if (!isStore) {
    const kept = segs.slice(0, 3).map((s) => (looksLikeId(s) ? "[id]" : s));
    return { path: "/" + kept.join("/"), area: "Platform pages" };
  }

  const rest = onPlatformHost ? segs.slice(1) : segs;
  const prefix = "/[store]";
  if (rest[0] === "admin") {
    const kept = rest.slice(1, 3).map((s) => (looksLikeId(s) ? "[id]" : s));
    return { path: [prefix, "admin", ...kept].join("/"), area: "Seller dashboard" };
  }
  if (!rest.length) return { path: prefix, area: "Storefront" };
  const second = rest.length > 1 ? "/[item]" : "";
  return { path: `${prefix}/${looksLikeId(rest[0]) ? "[id]" : rest[0]}${second}`, area: "Storefront" };
}
