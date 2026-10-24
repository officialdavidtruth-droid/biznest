import type { MetadataRoute } from "next";
import { SITE_URL, STORE_PRIVATE_PATHS } from "@/lib/seo";

// Public pages (home, templates, every storefront, product, service and
// category page) are crawlable. Everything behind a login, every checkout /
// cart / account screen, and every API route is not.
export default function robots(): MetadataRoute.Robots {
  const platformPrivate = [
    "/api/",
    "/supaadmin",
    "/admin",
    "/account",
    "/orders",
    "/disputes",
    "/invoices",
    "/quotes",
    "/projects",
    "/staff",
    "/onboarding",
    "/login",
    "/register",
    "/forgot-password",
    "/reset-password",
    "/verify-email",
    "/unsubscribe",
    "/template-preview",
  ];
  // "/*/admin" etc. -- on biznest.space a store lives at /<slug>/..., so the
  // store-level private pages sit one segment deep. Google and Bing both
  // understand the "*" wildcard.
  const storePrivate = STORE_PRIVATE_PATHS.map((p) => `/*${p}`);

  return {
    rules: [{ userAgent: "*", allow: "/", disallow: [...platformPrivate, ...storePrivate] }],
    sitemap: `${SITE_URL}/sitemap.xml`,
    host: SITE_URL,
  };
}
