import { cache } from "react";
import { prisma } from "@/lib/prisma";

/**
 * Finds one of a store's categories from the last URL segment of /category/<segment>.
 * The segment is normally the slug; an id is accepted too so every link printed before slugs existed
 * (Google results, QR codes, bookmarks, old menus) still lands on the right page. A slug always wins over an id.
 * Wrapped in cache() so generateMetadata and the page share one query per request.
 */
export const findStoreCategory = cache(async (storeId: string, segment: string) => {
  const include = { children: true } as const;
  const bySlug = await prisma.category.findFirst({ where: { storeId, slug: segment }, include });
  if (bySlug) return bySlug;
  return prisma.category.findFirst({ where: { storeId, id: segment }, include });
});
