/** Shared rules for portfolio albums (kept out of "use server" files so they can be unit-tested and used on the client). */
export const MAX_PORTFOLIO_ALBUMS = 30;
export const MAX_PORTFOLIO_IMAGES = 80;
export const PORTFOLIO_CATEGORY_SUGGESTIONS = ["Weddings", "Portraits", "Events", "Products", "Corporate", "Fashion", "Family", "Real estate"];

/** URL-safe album slug from a title ("Lagos Weddings 2026" -> "lagos-weddings-2026"). Never empty. */
export function slugifyAlbum(title: string): string {
  const base = String(title ?? "")
    .normalize("NFKD").replace(/[̀-ͯ]/g, "")
    .toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 60);
  return base || "album";
}

/** First slug not already taken: "weddings", "weddings-2", "weddings-3"... */
export function uniqueAlbumSlug(title: string, taken: Iterable<string>): string {
  const used = new Set(taken);
  const base = slugifyAlbum(title);
  if (!used.has(base)) return base;
  for (let n = 2; n < 1000; n++) if (!used.has(`${base}-${n}`)) return `${base}-${n}`;
  return `${base}-${Date.now().toString(36)}`;
}

/** Only Cloudinary-hosted https images are accepted, so an image field can't smuggle in arbitrary links. */
export function isPortfolioImageUrl(u: unknown): u is string {
  if (typeof u !== "string" || u.length > 600) return false;
  try {
    const url = new URL(u);
    return url.protocol === "https:" && url.hostname === "res.cloudinary.com";
  } catch { return false; }
}

/**
 * Display copy of a Cloudinary image: right-sized and auto format/quality, so a page of 10 MB photos still loads fast.
 * The stored original is never changed. Anything that isn't a plain Cloudinary upload URL is returned untouched.
 */
export function displayImageUrl(url: string, width: number): string {
  if (!isPortfolioImageUrl(url)) return url;
  const marker = "/image/upload/";
  const i = url.indexOf(marker);
  if (i === -1) return url;
  const head = url.slice(0, i + marker.length);
  const rest = url.slice(i + marker.length);
  // Already transformed (first path segment holds commas or "_" options, not a version like v123): leave it alone.
  if (!/^v\d+\//.test(rest) && /^[a-z]{1,3}_[^/]*\//i.test(rest)) return url;
  const w = Math.max(100, Math.min(Math.round(width), 3000));
  return `${head}f_auto,q_auto,w_${w}/${rest}`;
}

export const cleanText = (v: unknown, max: number): string => String(v ?? "").replace(/\s+/g, " ").trim().slice(0, max);

export const portfolioPath = (slug: string, albumSlug?: string) => `/store/${slug}/portfolio${albumSlug ? `/${albumSlug}` : ""}`;

/** Distinct, non-empty categories in the order they first appear (for the filter chips). */
export function albumCategories(albums: { category?: string | null }[]): string[] {
  const out: string[] = [];
  for (const a of albums) {
    const c = (a.category ?? "").trim();
    if (c && !out.includes(c)) out.push(c);
  }
  return out;
}
