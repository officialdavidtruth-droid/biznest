import type { Metadata } from "next";
import { APP_URL } from "@/lib/constants/app-url";

/**
 * Central SEO helpers: one place that decides what a page's canonical URL is,
 * how descriptions are trimmed, and how structured data (JSON-LD) is built.
 *
 * Canonical rule for storefronts: a store with a VERIFIED custom domain is
 * canonical on that domain; every other store is canonical on
 * <APP_URL>/<slug>. The /store/<slug> internal route is never exposed.
 */

export const SITE_NAME = "BizNest";
export const SITE_URL = APP_URL.replace(/\/+$/, "");

export const SITE_DESCRIPTION =
  "BizNest is an all-in-one platform for Nigerian businesses to open an online store, sell products, take bookings and reservations, and accept payments — no code needed.";

export const SITE_KEYWORDS = [
  "BizNest",
  "online store builder Nigeria",
  "create online store Nigeria",
  "website builder for small business",
  "sell online in Nigeria",
  "ecommerce platform Nigeria",
  "online booking system",
  "hotel booking website",
  "restaurant website builder",
  "Paystack store",
  "Flutterwave store",
  "Nigerian marketplace",
];

type StoreForSeo = {
  slug: string;
  customDomain?: string | null;
  customDomainStatus?: string | null;
};

/** Base URL (no trailing slash) a store is canonically served from. */
export function storeBaseUrl(store: StoreForSeo): string {
  if (store.customDomain && store.customDomainStatus === "VERIFIED") {
    return `https://${store.customDomain}`;
  }
  return `${SITE_URL}/${store.slug}`;
}

/** Absolute canonical URL for a path inside a store ("" or "/product/x"). */
export function storeUrl(store: StoreForSeo, path = ""): string {
  return `${storeBaseUrl(store)}${path === "/" ? "" : path}`;
}

export function absoluteUrl(src: string | null | undefined, base: string = SITE_URL): string | undefined {
  if (!src) return undefined;
  if (/^https?:\/\//i.test(src)) return src;
  if (src.startsWith("//")) return `https:${src}`;
  return `${base}${src.startsWith("/") ? "" : "/"}${src}`;
}

/** Collapse whitespace/HTML and cut at a word boundary (≈155 chars is what Google shows). */
export function cleanDescription(input: string | null | undefined, max = 155): string | undefined {
  if (!input) return undefined;
  const text = input.replace(/<[^>]*>/g, " ").replace(/\s+/g, " ").trim();
  if (!text) return undefined;
  if (text.length <= max) return text;
  const cut = text.slice(0, max - 1);
  const lastSpace = cut.lastIndexOf(" ");
  return `${(lastSpace > max * 0.6 ? cut.slice(0, lastSpace) : cut).replace(/[\s,;:.\-–—]+$/, "")}…`;
}

export const NO_INDEX: Metadata["robots"] = { index: false, follow: false };

/** Serialises JSON-LD so a "</script>" inside user content can never break out of the tag. */
export function jsonLdString(data: unknown): string {
  return JSON.stringify(data).replace(/</g, "\\u003c").replace(/>/g, "\\u003e").replace(/&/g, "\\u0026");
}

export function parseKeywords(raw: string | null | undefined): string[] | undefined {
  const list = (raw ?? "").split(",").map((k) => k.trim()).filter(Boolean).slice(0, 20);
  return list.length ? list : undefined;
}

/** schema.org availability URL */
export function availability(inStock: boolean, preorder = false): string {
  if (preorder) return "https://schema.org/PreOrder";
  return inStock ? "https://schema.org/InStock" : "https://schema.org/OutOfStock";
}

/** Paths that must never be crawled/indexed, relative to a storefront root. */
export const STORE_PRIVATE_PATHS = [
  "/admin",
  "/checkout",
  "/cart",
  "/account",
  "/orders",
  "/payment",
  "/wallet-pay",
  "/favorites",
  "/search",
  "/booking",
];

export type SitemapEntry = {
  url: string;
  lastModified?: Date | string | null;
  changeFrequency?: "daily" | "weekly" | "monthly";
  priority?: number;
};

const xmlEscape = (s: string) =>
  s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;").replace(/'/g, "&apos;");

export function buildSitemapXml(entries: SitemapEntry[]): string {
  const rows = entries.map((e) => {
    const last = e.lastModified ? new Date(e.lastModified) : null;
    return [
      "  <url>",
      `    <loc>${xmlEscape(e.url)}</loc>`,
      last && !Number.isNaN(last.getTime()) ? `    <lastmod>${last.toISOString()}</lastmod>` : "",
      e.changeFrequency ? `    <changefreq>${e.changeFrequency}</changefreq>` : "",
      e.priority !== undefined ? `    <priority>${e.priority.toFixed(1)}</priority>` : "",
      "  </url>",
    ].filter(Boolean).join("\n");
  });
  return `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${rows.join("\n")}\n</urlset>\n`;
}
