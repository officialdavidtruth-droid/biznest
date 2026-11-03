import { CONTENT_PAGES } from "@/lib/storefront/page-registry";

export type PageContent = { body: string; blocks?: import("@/lib/storefront/page-blocks").PageBlock[] };

// The starter set offered in the "Pages" panel. Defined once in lib/storefront/page-registry.ts.
// A vendor can also add a custom one with any slug.
export const SUGGESTED_PAGE_SLUGS = CONTENT_PAGES.map((p) => p.slug) as unknown as readonly ["about", "gallery", "faq", "blog", "contact", "policies"];
export const SUGGESTED_PAGE_TITLES: Record<string, string> = Object.fromEntries(CONTENT_PAGES.map((p) => [p.slug, p.title]));

// Folders under app/store/[slug]/ (plus a few reserved files). A static route always wins over the dynamic
// /[pageSlug] route, so a custom page saved under one of these slugs could never be reached. The six suggested
// slugs above are exempt: each has a built-in route that shows the saved page (see lib/storefront/owner-pages.ts).
// lib/utils/__tests__/reserved-page-slugs.test.ts fails when a new route folder is added without being listed here.
export const RESERVED_PAGE_SLUGS: ReadonlySet<string> = new Set([
  "home", "account", "admin", "amenities", "book", "booking", "brands", "cart", "catalog", "categories", "category", "checkout", "deals", "dining", "events", "experiences", "facilities", "favorites", "new-arrivals", "offers", "order-request", "orders", "pay", "payment", "portfolio", "pricing", "product", "pwa-icon", "reservations", "review", "reviews", "rooms", "search", "service", "services", "start-project", "support", "wallet-pay", "manifest.webmanifest", "robots.txt", "sitemap.xml", "sw.js", "api", "template-gallery"
]);
