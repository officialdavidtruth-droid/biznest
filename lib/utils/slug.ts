import slugify from "slugify";
import { prisma } from "@/lib/prisma";

// Subdomains middleware.ts treats specially, and so must never be handed out
// as a store slug — supaadmin.biznest.space is the platform admin panel
// (see subdomainSlug's guard in middleware.ts), "www" is the apex site.
const RESERVED_SLUGS = new Set(["supaadmin", "www"]);

/**
 * Generates a unique, URL-safe slug for a store, e.g.
 * "Stacey's Paradise" -> "staceys-paradise", and, on collision,
 * "staceys-paradise-2", "staceys-paradise-3", ...
 *
 * The collision check is injected (`slugExists`) so the collision-retry
 * logic itself can be unit tested without a database — see
 * lib/utils/__tests__/slug.test.ts. Production callers get the real
 * Prisma-backed check via the default parameter.
 */
export async function generateUniqueStoreSlug(
  storeName: string,
  slugExists: (slug: string) => Promise<boolean> = async (slug) =>
    (await prisma.store.findUnique({ where: { slug } })) !== null
): Promise<string> {
  const base = slugify(storeName, { lower: true, strict: true });
  let candidate = base;
  let suffix = 1;

  // Loop rather than a single query so we always land on the first free slug,
  // even under concurrent store creation. Reserved slugs are treated as
  // permanently "taken" so they fall straight into the -2, -3, ... suffix path.
  while (RESERVED_SLUGS.has(candidate) || (await slugExists(candidate))) {
    suffix += 1;
    candidate = `${base}-${suffix}`;
  }

  return candidate;
}

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
