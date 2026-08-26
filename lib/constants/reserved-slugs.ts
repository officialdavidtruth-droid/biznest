/**
 * Path segments that can never be handed out as a store slug, because
 * biznest.space/<slug> now resolves to a store (see middleware.ts) and
 * these are all real top-level routes (or reserved words) that would
 * otherwise collide with it.
 *
 * Deliberately edge-safe (no Prisma/Node-only imports) so middleware.ts
 * can import it directly — middleware always runs on the Edge Runtime.
 *
 * Keep this in sync with the top-level folders under app/ (including
 * route groups like app/(auth)) plus anything else that lives at the
 * site root.
 */
export const RESERVED_SLUGS = new Set([
  // apex / platform hosts
  "www",
  "supaadmin",
  // framework / infra
  "api",
  "_next",
  "favicon.ico",
  "robots.txt",
  "sitemap.xml",
  // top-level app/ routes
  "store",
  "account",
  "orders",
  "invoices",
  "quotes",
  "disputes",
  "search",
  "templates",
  "template-preview",
  "seller-agreement",
  "terms",
  "privacy",
  "onboarding",
  "staff",
  "verify-email",
  // app/(auth)
  "login",
  "register",
  "forgot-password",
  "reset-password",
  // protected prefixes referenced in middleware.ts that don't have a
  // route folder yet but are reserved for future use
  "admin",
  "dashboard",
]);
