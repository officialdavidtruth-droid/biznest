/**
 * Validators for store-owner-supplied display values (theme colors, social links).
 * These values are rendered on the public storefront -- some of them inside
 * <style> blocks and href attributes -- so they must be validated when saved AND
 * re-checked when rendered (rows saved before validation existed may hold anything).
 */

const HEX_COLOR_RE = /^#(?:[0-9a-f]{3}|[0-9a-f]{4}|[0-9a-f]{6}|[0-9a-f]{8})$/i;

/** Returns the color if it is a plain #rgb/#rgba/#rrggbb/#rrggbbaa hex value, else null. */
export function sanitizeHexColor(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const v = value.trim();
  return HEX_COLOR_RE.test(v) ? v : null;
}

/** Returns a normalized http(s) URL, or null for anything else (javascript:, data:, relative, malformed). */
export function sanitizeHttpUrl(value: unknown, maxLength = 300): string | null {
  if (typeof value !== "string") return null;
  const v = value.trim();
  if (!v || v.length > maxLength) return null;
  try {
    const url = new URL(v);
    if (url.protocol !== "https:" && url.protocol !== "http:") return null;
    if (url.username || url.password) return null;
    return url.toString();
  } catch {
    return null;
  }
}

/** The only body fonts the Settings form offers; anything else is rejected. */
export const STORE_FONT_OPTIONS = [
  { value: "", label: "Template default" },
  { value: "'Inter', sans-serif", label: "Inter (clean, modern)" },
  { value: "'Plus Jakarta Sans', sans-serif", label: "Plus Jakarta Sans (friendly, rounded)" },
  { value: "'Georgia', serif", label: "Georgia (classic, editorial)" },
  { value: "'Playfair Display', serif", label: "Playfair Display (elegant, upscale)" },
  { value: "'Space Grotesk', sans-serif", label: "Space Grotesk (bold, technical)" },
  { value: "'Courier New', monospace", label: "Courier New (typewriter)" },
] as const;

export function isAllowedStoreFont(value: string): boolean {
  return STORE_FONT_OPTIONS.some((o) => o.value === value);
}

export const STORE_SETTINGS_LIMITS = { name: 120, contactPhone: 30, contactEmail: 180, description: 5000 } as const;
