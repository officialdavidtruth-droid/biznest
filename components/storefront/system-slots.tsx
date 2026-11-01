import type { ReactNode } from "react";
import { PageBlocks, type BlockTokens } from "@/components/storefront/page-blocks";
import { LiveSystemSlot } from "@/components/storefront/live-system-slot";
import { resolveBlockCatalog } from "@/lib/storefront/page-block-catalog";
import { readSystemSections, type SystemPageKey } from "@/lib/storefront/system-sections";

/**
 * The owner's blocks above and below a platform page's main part. A side with nothing to show renders nothing, so a
 * store that never customised the page looks exactly as before. Each side is wrapped so the Customize preview can show
 * unsaved blocks live.
 */
export async function buildSystemSlots(
  store: { id: string; slug: string; sectionOverrides: unknown },
  page: SystemPageKey,
  tokens: BlockTokens,
): Promise<{ top: ReactNode; bottom: ReactNode }> {
  const { above, below } = readSystemSections(store.sectionOverrides, page);
  const catalog = above.length === 0 && below.length === 0 ? {} : await resolveBlockCatalog(store.id, [...above, ...below]);
  const wrap = (blocks: typeof above, key: string) =>
    blocks.length ? (
      <div key={key} style={{ maxWidth: 1100, margin: "0 auto", padding: "8px 20px" }}>
        <PageBlocks blocks={blocks} catalog={catalog} slug={store.slug} wide tokens={tokens} />
      </div>
    ) : null;
  // Each side is wrapped so the Customize preview can show unsaved blocks live. For visitors it renders `wrap(...)` unchanged.
  return {
    top: <LiveSystemSlot page={page} side="above" slug={store.slug} tokens={tokens}>{wrap(above, "above")}</LiveSystemSlot>,
    bottom: <LiveSystemSlot page={page} side="below" slug={store.slug} tokens={tokens}>{wrap(below, "below")}</LiveSystemSlot>,
  };
}
