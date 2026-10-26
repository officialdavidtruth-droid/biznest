const { withSentryConfig } = require("@sentry/nextjs/config");

/** @type {import('next').NextConfig} */
const nextConfig = {
  images: {
    remotePatterns: [
      { protocol: "https", hostname: "res.cloudinary.com" },
      { protocol: "https", hostname: "lh3.googleusercontent.com" },
    ],
  },
  experimental: {
    serverActions: {
      bodySizeLimit: "10mb",
    },
  },
  async headers() {
    // Pages that must never appear in search results: logins, dashboards,
    // carts/checkout, personal account pages. X-Robots-Tag works for every
    // response under these paths (pages, redirects, route handlers) and
    // doesn't depend on each layout remembering to set robots metadata.
    // "/:slug/..." covers biznest.space/<slug>/...; the bare paths cover a
    // vendor's custom domain (where there is no slug segment).
    const NOINDEX_SOURCES = [
      "/supaadmin/:path*", "/admin/:path*", "/account/:path*", "/orders/:path*", "/disputes/:path*",
      "/invoices/:path*", "/quotes/:path*", "/projects/:path*", "/staff/:path*", "/onboarding/:path*",
      "/login", "/register", "/forgot-password", "/reset-password", "/verify-email", "/unsubscribe",
      "/template-preview/:path*", "/api/:path*",
      "/:slug/admin/:path*", "/:slug/checkout/:path*", "/:slug/cart", "/:slug/account/:path*",
      "/:slug/orders/:path*", "/:slug/payment/:path*", "/:slug/wallet-pay/:path*", "/:slug/favorites",
      "/:slug/search", "/:slug/booking/:path*", "/:slug/login", "/:slug/register",
      "/store/:slug/admin/:path*", "/store/:slug/checkout/:path*",
      "/checkout/:path*", "/cart", "/payment/:path*", "/wallet-pay/:path*", "/favorites"
    ];
    return [
      // Make Android treat the APK as a file download, not a page to render.
      {
        source: "/downloads/biznest.apk",
        headers: [
          { key: "Content-Type", value: "application/vnd.android.package-archive" },
          { key: "Content-Disposition", value: 'attachment; filename="biznest.apk"' },
          { key: "Cache-Control", value: "public, max-age=0, must-revalidate" },
        ],
      },
      ...NOINDEX_SOURCES.map((source) => ({
        source,
        headers: [{ key: "X-Robots-Tag", value: "noindex, nofollow" }],
      })),
      {
        source: "/:path*",
        headers: [
          { key: "Strict-Transport-Security", value: "max-age=63072000; includeSubDomains; preload" },
          { key: "X-Content-Type-Options", value: "nosniff" },
          { key: "X-Frame-Options", value: "SAMEORIGIN" },
          { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
          { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=(self)" },
          {
            key: "Content-Security-Policy",
            value: [
              "default-src 'self'",
              "script-src 'self' 'unsafe-inline' 'unsafe-eval' https://js.paystack.co https://checkout.flutterwave.com https://checkout.paystack.com https://korablobstorage.blob.core.windows.net https://*.korapay.com",
              "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com",
              // Website Intelligence pulls logos/catalog images straight from
              // whatever domain a merchant's own connected website happens to
              // host them on (Supabase Storage, Shopify CDN, Wix, a bare S3
              // bucket -- anything). That domain can never be known ahead of
              // time, so a fixed per-host allowlist here is fundamentally
              // incompatible with the feature: every scanned logo that isn't
              // already on one of the hardcoded hosts below gets silently
              // blocked by the browser and renders as a broken image, no
              // matter how correct the scanned URL is server-side. Scoped to
              // https: only (never a blanket http:/data:-everywhere image-src)
              // so this stays a real restriction, just not a fixed host list.
              "img-src 'self' data: https:",
              "font-src 'self' data: https://fonts.gstatic.com",
              "connect-src 'self' https://*.sentry.io https://api.cloudinary.com https://accounts.google.com https://*.paystack.co https://*.paystack.com https://*.flutterwave.com https://*.korapay.com https://korablobstorage.blob.core.windows.net",
              "frame-src 'self' https://checkout.paystack.com https://js.paystack.co https://*.paystack.com https://checkout.flutterwave.com https://*.flutterwave.com https://*.korapay.com",
              "frame-ancestors 'self'",
              "object-src 'none'",
              "manifest-src 'self'",
              "base-uri 'self'",
              "form-action 'self'",
            ].join("; "),
          },
        ],
      },
    ];
  },
};

// Source-map upload + release tagging for readable Sentry stack traces.
// Without SENTRY_AUTH_TOKEN the build still succeeds; traces are just minified.
module.exports = withSentryConfig(nextConfig, {
  org: process.env.SENTRY_ORG,
  project: process.env.SENTRY_PROJECT,
  authToken: process.env.SENTRY_AUTH_TOKEN,
  silent: !process.env.CI,
  telemetry: false,
  widenClientFileUpload: true,
  sourcemaps: { deleteSourcemapsAfterUpload: true },
});