import { prisma } from "@/lib/prisma";

/** The pages the owner can write in Customize > Pages that have a built-in storefront route. */
export type OwnerPageSlug = "about" | "contact" | "gallery" | "blog";

export type OwnerPage = { title: string; body: string };

/** The owner's published page for this slug, or null when it is missing, unpublished or empty. */
export async function getOwnerPage(storeId: string, pageSlug: OwnerPageSlug): Promise<OwnerPage | null> {
  const page = await prisma.storePage.findUnique({ where: { storeId_slug: { storeId, slug: pageSlug } } }).catch(() => null);
  if (!page || !page.isPublished) return null;
  const body = String((page.content as { body?: string } | null)?.body ?? "").trim();
  if (!body) return null;
  return { title: page.title.trim() || pageSlug, body };
}
