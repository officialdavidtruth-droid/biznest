/**
 * Customer preferences are free-form JSON written by the customer's browser, so they are
 * reduced to a small, flat set of short values before being stored. Without this a single
 * account could save an arbitrarily large (or deeply nested) blob on its profile.
 */
export const PREFERENCE_MAX_KEYS = 40;
export const PREFERENCE_MAX_TEXT = 300;

export function sanitizePreferences(input: unknown): Record<string, string | number | boolean> {
  const out: Record<string, string | number | boolean> = {};
  if (!input || typeof input !== "object" || Array.isArray(input)) return out;
  for (const [key, value] of Object.entries(input as Record<string, unknown>)) {
    if (Object.keys(out).length >= PREFERENCE_MAX_KEYS) break;
    if (!/^[A-Za-z][A-Za-z0-9_]{0,39}$/.test(key)) continue;
    if (typeof value === "boolean") out[key] = value;
    else if (typeof value === "number" && Number.isFinite(value)) out[key] = value;
    else if (typeof value === "string") out[key] = value.replace(/[\u0000-\u001f\u007f]/g, " ").trim().slice(0, PREFERENCE_MAX_TEXT);
  }
  return out;
}
