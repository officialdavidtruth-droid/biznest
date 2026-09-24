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
    return [
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
              "script-src 'self' 'unsafe-inline' 'unsafe-eval'",
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
              "connect-src 'self' https://api.cloudinary.com https://accounts.google.com https://*.paystack.co https://*.flutterwave.com",
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

module.exports = nextConfig;