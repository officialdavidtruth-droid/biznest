import slugify from "slugify";
import { prisma } from "@/lib/prisma";
import { RESERVED_SLUGS } from "@/lib/constants/reserved-slugs";

// RESERVED_SLUGS (shared with middleware.ts) covers every top-level route —
// biznest.space/<slug> now resolves to a store, so a slug can never be
// allowed to collide with a real route like /account or /supaadmin.

// Shared by generateUniqueStoreSlug below and updateStoreSlug (the owner-
// facing "shorten your store URL" action in lib/actions/store.ts) so both
// paths agree on what a legal slug looks like: lowercase letters, digits,
// and single hyphens, never leading/trailing/doubled.
export const SLUG_FORMAT_RE = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;
export const SLUG_MIN_LENGTH = 2;
export const SLUG_MAX_LENGTH = 63;

/**
 * Resolves a slug to whatever the store's *current* slug is right now —
 * either because it still matches directly, or because it's a retired slug
 * recorded in StoreSlugHistory after an owner renamed their store (see
 * updateStoreSlug). Returns null if the slug never belonged to any store.
 *
 * Used wherever a stale/bookmarked slug needs to keep working transparently:
 * app/store/[slug]/layout.tsx (storefront redirect) and the staff
 * "<username>@<store-slug>" login lookup in lib/auth.ts.
 */
export async function resolveCurrentSlug(slug: string): Promise<string | null> {
  const direct = await prisma.store.findUnique({ where: { slug }, select: { slug: true } });
  if (direct) return direct.slug;

  const retired = await prisma.storeSlugHistory.findUnique({
    where: { oldSlug: slug },
    select: { store: { select: { slug: true } } },
  });
  return retired?.store.slug ?? null;
}

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
  // Same fallback as lib/constants/app-url.ts — kept as a literal here
  // rather than importing it, since that constant already reads
  // NEXT_PUBLIC_APP_URL itself and this function needs the raw env value
  // to fall back independently.
  const base = process.env.NEXT_PUBLIC_APP_URL ?? "https://www.biznest.space";
  const { protocol, host } = new URL(base);
  const root = host.replace(/^www\./, "");

  // Every store lives at biznest.space/<slug> — middleware.ts rewrites
  // this to /store/<slug> internally for any segment that isn't in
  // RESERVED_SLUGS. Works the same in prod, previews, and local dev,
  // since it doesn't depend on wildcard DNS the way subdomains did.
  return `${protocol}//${root}/${slug}`;
}

export function storeAdminUrl(slug: string): string {
  return `${storePublicUrl(slug)}/admin`;
}
