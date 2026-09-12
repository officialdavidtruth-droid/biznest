/** Route-safety helpers for the currently shipped storefront foundation. */
export const STOREFRONT_ROUTES = new Set([
  "", "about", "services", "portfolio", "pricing", "contact", "catalog", "products",
  "search", "account", "cart", "checkout", "reservations", "gallery", "events", "payment",
  "orders/track", "faq", "policies",
]);
export function isSafeStorefrontRoute(path: string) {
  const normalized = path.replace(/^\//, "").replace(/\/$/, "");
  return STOREFRONT_ROUTES.has(normalized) || normalized.startsWith("product/") || normalized.startsWith("service/") || normalized.startsWith("orders/");
}
export const FORBIDDEN_DEMO_CLAIMS = [
  /\b\d+[KMB]\+?\s+happy customers\b/i,
  /\b\d+\+?\s+years?\s+of\s+experience\b/i,
  /\b\d+\+?\s+countries?\s+served\b/i,
  /\b100%\s+(fresh|cruelty[- ]free|secure|guaranteed)\b/i,
  /\b(licensed|insured|certified)\b/i,
];
export function containsDemoClaim(text: string) { return FORBIDDEN_DEMO_CLAIMS.some((pattern) => pattern.test(text)); }
