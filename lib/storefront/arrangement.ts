/**
 * Section arrangement for templates that draw their own homepage (legacy, signature, hotel, example).
 * Their layouts live in code, so owners can't edit a block list the way they can in the visual builder.
 * Instead the owner saves just two lists of section keys (their order, and which are hidden) under
 * sectionOverrides.templateArrangement, and <SectionArranger> applies them to the rendered page.
 */
export type TemplateArrangement = { order: string[]; hidden: string[] };

export const EMPTY_ARRANGEMENT: TemplateArrangement = { order: [], hidden: [] };
export const ARRANGEMENT_KEY = "templateArrangement";
const MAX_KEYS = 40;
const MAX_KEY_LENGTH = 80;

function cleanList(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  const seen = new Set<string>();
  for (const v of value) {
    if (typeof v !== "string") continue;
    const key = v.trim().slice(0, MAX_KEY_LENGTH);
    if (key) seen.add(key);
    if (seen.size >= MAX_KEYS) break;
  }
  return [...seen];
}

export function normalizeArrangement(value: unknown): TemplateArrangement {
  if (!value || typeof value !== "object" || Array.isArray(value)) return EMPTY_ARRANGEMENT;
  const v = value as Record<string, unknown>;
  return { order: cleanList(v.order), hidden: cleanList(v.hidden) };
}

export function getTemplateArrangement(sectionOverrides: unknown): TemplateArrangement {
  if (!sectionOverrides || typeof sectionOverrides !== "object" || Array.isArray(sectionOverrides)) return EMPTY_ARRANGEMENT;
  return normalizeArrangement((sectionOverrides as Record<string, unknown>)[ARRANGEMENT_KEY]);
}
