import { prisma } from "@/lib/prisma";

export type StoreBranding = { name: string; logoUrl: string | null } | null;

/**
 * Minimal, public-safe store lookup for the shared login/register pages
 * (app/(auth)/**), so a customer who followed AccountLink in from a
 * storefront sees "Sign in to <Store>" instead of generic BizNest
 * branding. Deliberately not a "use server" action — this is a plain
 * read used during render, not a mutation invoked from a form.
 */
export async function getStoreBranding(slug: string | undefined): Promise<StoreBranding> {
  if (!slug) return null;
  const store = await prisma.store.findUnique({
    where: { slug },
    select: { name: true, logoUrl: true },
  });
  return store;
}
