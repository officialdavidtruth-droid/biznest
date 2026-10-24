import { resolveStoreTheme } from "@/lib/template-themes";
import { DEFAULT_STORE_PALETTE, type StorePalette } from "@/lib/store-palette-defaults";

export { DEFAULT_STORE_PALETTE, type StorePalette };

/**
 * Colour/font tokens for the shared cart and checkout pages, derived from the
 * store's selected template (plus any saved colour/font overrides) so those
 * pages match the storefront the customer just came from.
 */
const HEX = /^#([0-9a-f]{3}|[0-9a-f]{6})$/i;

function luminance(hex: string): number {
  let h = hex.replace("#", "");
  if (h.length === 3) h = h.split("").map((c) => c + c).join("");
  const [r, g, b] = [0, 2, 4].map((i) => parseInt(h.slice(i, i + 2), 16) / 255);
  const lin = (v: number) => (v <= 0.03928 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4));
  return 0.2126 * lin(r) + 0.7152 * lin(g) + 0.0722 * lin(b);
}

const isHex = (v: unknown): v is string => typeof v === "string" && HEX.test(v);
const pick = (v: unknown, fallback: string) => (isHex(v) ? v : fallback);

export function resolveStorePalette(store: {
  name: string;
  themeColors?: unknown;
  fontFamily?: string | null;
  template?: { name: string; category: string } | null;
}): StorePalette {
  try {
    const t = resolveStoreTheme(
      store.template?.category,
      store.name,
      (store.themeColors as { primary?: string; secondary?: string; accent?: string } | null) ?? null,
      store.fontFamily,
      store.template?.name,
    );
    const d = DEFAULT_STORE_PALETTE;
    const accent = pick(t.accent, d.accent);
    const ink = pick(t.ink, d.ink);
    const surface = pick(t.bg, d.surface);
    const card = pick(t.card, d.card);
    const inverse = pick(t.surfaceDark, ink);
    return {
      accent,
      onAccent: luminance(accent) > 0.5 ? "#111111" : "#FFFFFF",
      ink,
      surface,
      card,
      cardAlt: card,
      inverse,
      inverseInk: luminance(inverse) > 0.5 ? "#111111" : pick(t.bg, "#FFFFFF"),
      font: t.font || d.font,
      headlineFont: t.headlineFont || d.headlineFont,
    };
  } catch {
    return DEFAULT_STORE_PALETTE;
  }
}
