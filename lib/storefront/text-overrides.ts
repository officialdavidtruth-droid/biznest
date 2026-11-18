/**
 * "Click any text to change it": the owner's replacements for wording on their storefront, stored as
 * Store.storefrontConfig.textOverrides = { "<text as it appears>": "<text to show instead>" } (JSON, no migration).
 * Matching is on the visible text with whitespace collapsed, so it works on every template and every page.
 */
export type TextOverrides = Record<string, string>;

export const MAX_TEXT_OVERRIDES = 300;
export const MAX_ORIGINAL_LENGTH = 300;
export const MAX_REPLACEMENT_LENGTH = 800;

export function normalizeText(s: string): string {
  return s.replace(/\s+/g, " ").trim();
}

export function sanitizeTextOverrides(raw: unknown): TextOverrides {
  const out: TextOverrides = {};
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return out;
  for (const [k, v] of Object.entries(raw as Record<string, unknown>)) {
    if (typeof v !== "string") continue;
    const key = normalizeText(k);
    const value = v.replace(/\r/g, "").trim();
    if (!key || key.length > MAX_ORIGINAL_LENGTH || !value || value.length > MAX_REPLACEMENT_LENGTH) continue;
    out[key] = value;
    if (Object.keys(out).length >= MAX_TEXT_OVERRIDES) break;
  }
  return out;
}

export function readTextOverrides(storefrontConfig: unknown): TextOverrides {
  if (!storefrontConfig || typeof storefrontConfig !== "object" || Array.isArray(storefrontConfig)) return {};
  return sanitizeTextOverrides((storefrontConfig as { textOverrides?: unknown }).textOverrides);
}
