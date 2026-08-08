import slugify from "slugify";
import { prisma } from "@/lib/prisma";

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
  // even under concurrent store creation.
  while (await slugExists(candidate)) {
    suffix += 1;
    candidate = `${base}-${suffix}`;
  }

  return candidate;
}

export function storePublicUrl(slug: string): string {
  const base = process.env.NEXT_PUBLIC_APP_URL ?? "https://biznest.vercel.app";
  return `${base}/store/${slug}`;
}

export function storeAdminUrl(slug: string): string {
  return `${storePublicUrl(slug)}/admin`;
}
