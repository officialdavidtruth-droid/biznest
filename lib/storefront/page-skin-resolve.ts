import { PAGE_SKIN_TABLE, DEFAULT_PAGE_SKIN, SKIN_AXES, type PageSkin } from "@/lib/storefront/page-skin";

/** Recipe for a template. A name missing from the frozen table (a brand-new template) gets a stable hash-derived one. */
export function pageSkinFor(templateName: string | null | undefined): PageSkin {
  if (!templateName) return DEFAULT_PAGE_SKIN;
  const known = PAGE_SKIN_TABLE[templateName];
  if (known) return known;
  let h = 2166136261;
  for (const ch of templateName) h = Math.imul(h ^ ch.charCodeAt(0), 16777619) >>> 0;
  const out: Record<string, string> = {};
  for (const [k, vals] of Object.entries(SKIN_AXES)) { out[k] = vals[h % vals.length]; h = Math.imul(h ^ (h >>> 13), 2246822519) >>> 0; }
  return out as unknown as PageSkin;
}
