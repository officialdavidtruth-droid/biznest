// Deliberately has ZERO Node-only / server-only imports (no Prisma, no
// "next/headers", etc.) so it's safe to import from "use client" components
// — e.g. the "View live store" link in components/dashboard/sidebar.tsx —
// as well as from Server Actions and Server Components. Importing this from
// lib/utils/slug.ts instead would pull `@/lib/prisma` (and therefore
// @prisma/client) into the client bundle and break the build, since Prisma
// Client cannot run in the browser.

export function storePublicUrl(slug: string): string {
  const base = process.env.NEXT_PUBLIC_APP_URL ?? "https://biznest.vercel.app";
  const { protocol, host } = new URL(base);
  const root = host.replace(/^www\./, "");

  // Subdomain storefronts (yourname.biznest.space) only work where we
  // actually control wildcard DNS + a wildcard domain on the Vercel
  // project — that's just production. Local dev and Vercel preview
  // deployments fall back to the path-based /store/[slug] URL, which
  // middleware.ts still serves directly regardless of host.
  if (root === "biznest.space") {
    return `${protocol}//${slug}.${root}`;
  }
  return `${base}/store/${slug}`;
}

export function storeAdminUrl(slug: string): string {
  return `${storePublicUrl(slug)}/admin`;
}
