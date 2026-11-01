import type { ReactNode } from "react";
import { PageBlocks, type BlockTokens } from "@/components/storefront/page-blocks";
import { resolveBlockCatalog } from "@/lib/storefront/page-block-catalog";
import { readSystemSections, type SystemPageKey } from "@/lib/storefront/system-sections";

/**
 * The owner's blocks above and below a platform page's main part. Returns null for a side with nothing to show, so a
 * store that never customised the page renders exactly as before.
 */
export async function buildSystemSlots(
  store: { id: string; slug: string; sectionOverrides: unknown },
  page: SystemPageKey,
  tokens: BlockTokens,
): Promise<{ top: ReactNode; bottom: ReactNode }> {
  const { above, below } = readSystemSections(store.sectionOverrides, page);
  if (above.length === 0 && below.length === 0) return { top: null, bottom: null };
  const catalog = await resolveBlockCatalog(store.id, [...above, ...below]);
  const wrap = (blocks: typeof above, key: string) =>
    blocks.length ? (
      <div key={key} style={{ maxWidth: 1100, margin: "0 auto", padding: "8px 20px" }}>
        <PageBlocks blocks={blocks} catalog={catalog} slug={store.slug} wide tokens={tokens} />
      </div>
    ) : null;
  return { top: wrap(above, "above"), bottom: wrap(below, "below") };
}
