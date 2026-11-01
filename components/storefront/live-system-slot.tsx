"use client";

import { useEffect, useState, type ReactNode } from "react";
import { PageBlocks, type BlockTokens } from "@/components/storefront/page-blocks";
import { sanitizeSystemSections, type SystemPageKey } from "@/lib/storefront/system-sections";
import type { PageBlock } from "@/lib/storefront/page-blocks";

/** True only inside the Customize preview: framed by a page of the same site. A visitor's page never takes drafts. */
function inOwnPreview(): boolean {
  try {
    if (window.self === window.top) return false;
    return window.parent.location.origin === window.location.origin;
  } catch {
    return false;
  }
}

/**
 * One side (above or below) of a platform page. Visitors get exactly what the server drew (`children`). Inside the
 * Customize preview it shows the owner's unsaved blocks as they type, then goes back to the saved version on reload.
 * Product and collection blocks need catalogue data, so they show their saved cards until the owner saves.
 */
export function LiveSystemSlot({ page, side, slug, tokens, children }: { page: SystemPageKey; side: "above" | "below"; slug: string; tokens: BlockTokens; children?: ReactNode }) {
  const [draft, setDraft] = useState<PageBlock[] | null>(null);

  useEffect(() => {
    if (!inOwnPreview()) return;
    function onMessage(event: MessageEvent) {
      if (event.source !== window.parent || event.origin !== window.location.origin) return;
      const data = event.data;
      if (!data || data.type !== "BIZNEST_SYSTEM_SECTIONS_PREVIEW" || data.page !== page) return;
      setDraft(sanitizeSystemSections(data.sections)[side]);
    }
    window.addEventListener("message", onMessage);
    // Tell the editor this page is ready so it can send the draft it is holding.
    window.parent.postMessage({ type: "BIZNEST_SYSTEM_PREVIEW_READY", page }, window.location.origin);
    return () => window.removeEventListener("message", onMessage);
  }, [page, side]);

  if (draft === null) return <>{children}</>;
  if (draft.length === 0) return null;
  return (
    <div style={{ maxWidth: 1100, margin: "0 auto", padding: "8px 20px" }}>
      <PageBlocks blocks={draft} catalog={{}} slug={slug} wide tokens={tokens} />
    </div>
  );
}
