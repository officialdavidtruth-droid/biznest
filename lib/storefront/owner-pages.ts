import { prisma } from "@/lib/prisma";
import { hasPageContent, ownerPageBlocks, type PageBlock } from "@/lib/storefront/page-blocks";
import { ownerPageBody } from "@/lib/storefront/page-registry";
import { resolveBlockCatalog, type BlockCatalog } from "@/lib/storefront/page-block-catalog";

/** The pages the owner can write in Customize > Pages that have a built-in storefront route. */
export type OwnerPageSlug = "about" | "contact" | "gallery" | "blog";

export type OwnerPage = { title: string; body: string; blocks: PageBlock[]; catalog: BlockCatalog };

/** The owner's published page for this slug, or null when it is missing, unpublished or empty. */
export async function getOwnerPage(storeId: string, pageSlug: OwnerPageSlug): Promise<OwnerPage | null> {
  const page = await prisma.storePage.findUnique({ where: { storeId_slug: { storeId, slug: pageSlug } } }).catch(() => null);
  if (!page || !page.isPublished) return null;
  if (!hasPageContent(page.content)) return null;
  const blocks = ownerPageBlocks(page.content);
  return { title: page.title.trim() || pageSlug, body: (ownerPageBody(page.content) ?? "").trim(), blocks, catalog: await resolveBlockCatalog(storeId, blocks) };
}
