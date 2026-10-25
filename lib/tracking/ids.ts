/**
 * Validation for the per-store tracking IDs (Dashboard > Settings > Tracking &
 * analytics).
 *
 * These values are typed by store owners -- i.e. untrusted tenants -- and end
 * up in <script src> URLs and third-party API payloads on a public storefront.
 * So they are checked against strict allowlist patterns (not "looks roughly
 * right") in two places: when saved (lib/actions/tracking.ts) and again when
 * rendered (app/store/[slug]/layout.tsx), so a bad value that reached the DB
 * some other way (import, manual edit, old bug) still can't be injected.
 *
 * Pure module: no server-only / client-only imports, so it is safe everywhere
 * and trivially unit-testable.
 */

export type TrackingIds = {
  /** GA4 Measurement ID, e.g. G-ABC123XYZ9 */
  gaId: string | null;
  /** Meta (Facebook) Pixel ID, digits only */
  metaPixelId: string | null;
  /** Site domain exactly as registered in Plausible, e.g. mystore.com */
  plausibleDomain: string | null;
};

export type Parsed = { ok: true; value: string | null } | { ok: false; error: string };

const GA_ID_RE = /^G-[A-Z0-9]{6,12}$/;
const META_PIXEL_RE = /^\d{10,20}$/;
const DOMAIN_RE = /^(?=.{4,253}$)(?:[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?\.)+[a-z]{2,63}$/;

/** Empty input is valid and means "turn this off". */
export function parseGaId(raw: string | null | undefined): Parsed {
  const v = (raw ?? "").trim().toUpperCase();
  if (!v) return { ok: true, value: null };
  if (GA_ID_RE.test(v)) return { ok: true, value: v };
  if (v.startsWith("UA-")) {
    return { ok: false, error: "Universal Analytics (UA-) IDs no longer collect data. Use a GA4 Measurement ID that starts with G-." };
  }
  if (v.startsWith("GTM-") || v.startsWith("AW-")) {
    return { ok: false, error: "Enter your GA4 Measurement ID (starts with G-). Tag Manager and Google Ads IDs aren't supported here." };
  }
  return { ok: false, error: "Enter a GA4 Measurement ID like G-ABC123XYZ9." };
}

export function parseMetaPixelId(raw: string | null | undefined): Parsed {
  const v = (raw ?? "").replace(/\s+/g, "");
  if (!v) return { ok: true, value: null };
  if (META_PIXEL_RE.test(v)) return { ok: true, value: v };
  return { ok: false, error: "Enter your Meta Pixel ID: a number of 10 to 20 digits, with no letters." };
}

/**
 * Accepts what people actually paste: "mystore.com", "https://www.mystore.com/",
 * "MyStore.com/shop?x=1" -> "mystore.com" / "www.mystore.com". The www prefix is
 * kept on purpose: Plausible matches the domain string exactly as it was
 * registered, so stripping it could silently send events to a site that
 * doesn't exist.
 */
export function parsePlausibleDomain(raw: string | null | undefined): Parsed {
  let v = (raw ?? "").trim().toLowerCase();
  if (!v) return { ok: true, value: null };
  v = v.replace(/^[a-z][a-z0-9+.-]*:\/\//, "");
  v = v.split(/[/?#]/)[0].replace(/\.$/, "");
  if (DOMAIN_RE.test(v)) return { ok: true, value: v };
  return { ok: false, error: "Enter the domain you added in Plausible, like mystore.com." };
}

/**
 * Re-validates whatever is in the database before it is rendered. Anything
 * that doesn't pass is treated as "not set" rather than trusted.
 */
export function sanitizeStoredTrackingIds(row: {
  trackingGaId?: string | null;
  trackingMetaPixelId?: string | null;
  trackingPlausibleDomain?: string | null;
}): TrackingIds {
  const ga = parseGaId(row.trackingGaId);
  const meta = parseMetaPixelId(row.trackingMetaPixelId);
  const pl = parsePlausibleDomain(row.trackingPlausibleDomain);
  return {
    gaId: ga.ok ? ga.value : null,
    metaPixelId: meta.ok ? meta.value : null,
    plausibleDomain: pl.ok ? pl.value : null,
  };
}

export function hasAnyTracking(ids: TrackingIds): boolean {
  return Boolean(ids.gaId || ids.metaPixelId || ids.plausibleDomain);
}

/**
 * Storefront paths that must never be reported to third-party analytics:
 * the owner dashboard, signed-in customer account pages, and wallet-pay links
 * (the URL carries a payment token). Matched against the browser pathname,
 * which may or may not start with /store/<slug> (custom domains, path-based
 * slugs), so this looks at path segments rather than fixed positions.
 */
export function isTrackablePath(pathname: string): boolean {
  return !/(^|\/)(admin|account|wallet-pay)(\/|$)/.test(pathname);
}
