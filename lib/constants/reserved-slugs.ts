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
  // PWA manifest + the icon files it references (public/manifest.json) --
  // missing here meant middleware treated "manifest.json" itself as a
  // candidate store slug, found no matching store, and served a 404 HTML
  // page in place of the real file -- which is why the browser's console
  // reported a JSON parse error on it (a 404 page isn't valid JSON).
  "manifest.json",
  "icon-192.png",
  "icon-512.png",
  "icon-32.png",
  // Service worker script (public/sw.js) -- same failure mode as the
  // manifest above: missing here meant middleware served a 404 page in
  // place of the real script, so navigator.serviceWorker.register("/sw.js")
  // silently failed (caught by an empty .catch() in push-subscribe-
  // prompt.tsx), and the later `await navigator.serviceWorker.ready` in
  // that same file then hung forever waiting for a worker that could
  // never activate -- which is why the "Enable notifications" button
  // got stuck on "Enabling..." permanently.
  "sw.js",
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
