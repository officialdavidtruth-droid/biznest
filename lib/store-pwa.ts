// Shared helpers for the per-store installable web app (PWA): each store gets
// its own manifest + icons so "Add to Home Screen" installs *that store*
// (its name + logo), not the BizNest platform app.
//
//   biznest.space/<slug>      -> public base path "/<slug>"
//   mystore.com (custom dom.) -> public base path ""
//
// Middleware rewrites both onto /store/<slug>/..., so the same route files
// (manifest.webmanifest, pwa-icon/[size], sw.js) serve either form.

const ROOT_DOMAIN = "biznest.space";

/** Mirrors isPlatformHost() in middleware.ts: hosts that are BizNest itself. */
export function isPlatformHost(hostHeader: string | null | undefined): boolean {
  const host = (hostHeader ?? "").split(":")[0].toLowerCase();
  return (
    host === ROOT_DOMAIN ||
    host === `www.${ROOT_DOMAIN}` ||
    host === `supaadmin.${ROOT_DOMAIN}` ||
    host === "localhost" ||
    host.endsWith(".vercel.app")
  );
}

/** The URL prefix customers see for this store on this host. */
export function storeBasePath(hostHeader: string | null | undefined, slug: string): string {
  return isPlatformHost(hostHeader) ? `/${slug}` : "";
}

const HEX = /^#(?:[0-9a-f]{3}|[0-9a-f]{6})$/i;

/** Returns a safe #hex colour or the fallback. */
export function safeHex(value: unknown, fallback: string): string {
  return typeof value === "string" && HEX.test(value.trim()) ? value.trim() : fallback;
}

/** Cache-buster so a changed logo refreshes the installed icon. */
export function logoVersion(logoUrl: string | null | undefined): string {
  const s = logoUrl ?? "";
  let h = 0;
  for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) | 0;
  return (h >>> 0).toString(36);
}

/** Home-screen labels truncate hard, so keep short_name to ~12 chars. */
export function shortName(name: string): string {
  const trimmed = name.trim();
  if (trimmed.length <= 12) return trimmed;
  let out = "";
  for (const word of trimmed.split(/\s+/)) {
    const next = out ? `${out} ${word}` : word;
    if (next.length > 12) break;
    out = next;
  }
  return out || trimmed.slice(0, 12);
}
