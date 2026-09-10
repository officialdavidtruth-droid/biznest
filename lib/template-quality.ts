/** Template quality helpers. Keep storefront templates data-driven and route-safe. */
export const STOREFRONT_ROUTES = new Set([
  "", "about", "services", "portfolio", "pricing", "contact", "catalog", "products",
  "search", "account", "cart", "checkout", "hotel/rooms", "hotel/experience",
  "hotel/gallery", "hotel/contact", "start-project", "faq", "policies",
]);

export function isSafeStorefrontRoute(path: string) {
  const normalized = path.replace(/^\//, "").replace(/\/$/, "");
  return STOREFRONT_ROUTES.has(normalized) || normalized.startsWith("product/") || normalized.startsWith("service/") || normalized.startsWith("room/");
}

/**
 * These phrases are prohibited as hard-coded merchant claims in production templates.
 * They should only be supplied by real store data.
 */
export const FORBIDDEN_DEMO_CLAIMS = [
  /\b\d+[KMB]\+?\s+happy customers\b/i,
  /\b\d+\+?\s+years?\s+of\s+experience\b/i,
  /\b\d+\+?\s+countries?\s+served\b/i,
  /\b100%\s+(fresh|cruelty[- ]free|secure|guaranteed)\b/i,
  /\b(licensed|insured|certified)\b/i,
];

export function containsDemoClaim(text: string) {
  return FORBIDDEN_DEMO_CLAIMS.some((pattern) => pattern.test(text));
}
