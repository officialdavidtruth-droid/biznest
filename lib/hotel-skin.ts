// Hotel pages (rooms, dining, booking, ...) are rendered by one shared component
// (components/storefront/theluso-hotel.tsx). To stop every hotel store looking the
// same, that component is "skinned" with the palette + fonts of whichever template
// the store actually chose, so the inner pages match the template's home page.
//
// NOTE: the palettes / name maps below mirror the ones in
// components/storefront/storefront-runtime.tsx (that file cannot be imported from
// lib/ because it pulls in Prisma). Keep them in sync when adding a template.

export type HotelSkin = {
  bg: string; ink: string; card: string; accent: string; accentInk: string; accentText: string;
  muted: string; line: string; panel: string; font: string; headlineFont: string; dark: boolean;
  /** Layout identity of the template (hero arrangement + corner style), so templates differ in structure, not just colour. */
  variant: "fullbleed" | "centered" | "framed"; radius: string;
  /** Dedicated home layout (see components/storefront/hotel-reference-homes.tsx). */
  homeLayout?: "aspire" | "larita" | "skyview";
  /** Template's own marketing copy for the home hero. */
  headline?: string; sub?: string;
};

// Layout identity per hotel template. Unlisted templates keep the classic full-bleed hero.
const HOTEL_VARIANT_BY_NAME: Record<string, { variant: HotelSkin["variant"]; radius: string; homeLayout?: HotelSkin["homeLayout"] }> = {
  "Aspire Resort": { variant: "fullbleed", radius: "4px", homeLayout: "aspire" },
  "Larita Luxury Hotel": { variant: "centered", radius: "0px", homeLayout: "larita" },
  "Skyview Hotels & Resorts": { variant: "framed", radius: "20px", homeLayout: "skyview" },
  "Maison — Hotel & Stay": { variant: "centered", radius: "2px" },
  "Grand — Hotel & Hospitality": { variant: "fullbleed", radius: "10px" },
};

type Palette = { bg: string; ink: string; card: string; accent: string; muted?: string; border?: string; font: string; headlineFont: string; surfaceDark?: string };

// Templates whose home page is SignatureScreenshotHome (palette is passed in by the runtime).
const SCREENSHOT_PALETTES: Record<string, Palette> = {
  "great-treasure": { accent: "#E7A928", bg: "#07100D", ink: "#F7F3EA", card: "#101815", muted: "#B9B6AF", border: "#2C362F", headlineFont: "Georgia, serif", font: "Inter, sans-serif" },
  "grand-vere": { accent: "#0E5B45", bg: "#FFFFFF", ink: "#15392C", card: "#FFFFFF", muted: "#777777", border: "#E6E1D7", headlineFont: "Georgia, serif", font: "Inter, sans-serif" },
  "belora": { accent: "#7B4BC0", bg: "#F1EAF8", ink: "#2B2430", card: "#FFFFFF", muted: "#837B89", border: "#E8E0EF", headlineFont: "Georgia, serif", font: "Inter, sans-serif" },
  "flavora-restaurant": { accent: "#F39A0B", bg: "#100A06", ink: "#FFF7EF", card: "#17100C", muted: "#B7A8A1", border: "#352A29", headlineFont: "Georgia, serif", font: "Inter, sans-serif" },
  "tastehouse": { accent: "#F26B21", bg: "#FFFBF5", ink: "#241608", card: "#FFFFFF", muted: "#7A6A5D", border: "#F1E4D6", headlineFont: "Poppins, sans-serif", font: "Inter, sans-serif" },
};

const SCREENSHOT_MODE_BY_NAME: Record<string, string> = {
  "Maison — Hotel & Stay": "grand-vere",
  "Grand — Hotel & Hospitality": "great-treasure",
  "Bloom — Beauty Boutique": "belora",
  "Muse — Salon & Beauty": "belora",
  "Ember — Restaurant": "flavora-restaurant",
  "Grandeur — Fine Dining Restaurant": "flavora-restaurant",
  "TasteHouse — Food Delivery": "tastehouse",
};

// Signature templates that are rendered by one of the legacy templates.
const LEGACY_TARGET_BY_NAME: Record<string, string> = {
  "Electra — Smart Commerce": "Marketplace Hub",
  "Atelier — Modern Fashion": "Fabtex",
  "Kinetic — Sneaker Drop": "Heenzy Sneaker Co.",
  "Haven — Home & Furniture": "Arcova Architecture",
  "Harvest — Grocery Market": "Rivora Fresh",
  "Frame — Photography Studio": "Nova Studio — Noir",
  "North — Creative Agency": "Arcova Architecture",
  "Pure — Cleaning Services": "Fresh & Co.",
  "Forge — Construction": "Arcova Architecture",
};

function rgb(hex: string): [number, number, number] | null {
  const h = hex.trim().replace("#", "");
  const f = h.length === 3 ? h.split("").map((c) => c + c).join("") : h;
  if (!/^[0-9a-f]{6}$/i.test(f)) return null;
  return [parseInt(f.slice(0, 2), 16), parseInt(f.slice(2, 4), 16), parseInt(f.slice(4, 6), 16)];
}
const lum = (hex: string) => { const c = rgb(hex); return c ? (0.299 * c[0] + 0.587 * c[1] + 0.114 * c[2]) / 255 : 0.5; };
function mix(a: string, b: string, t: number) {
  const x = rgb(a), y = rgb(b); if (!x || !y) return a;
  const m = x.map((v, i) => Math.round(v * t + y[i] * (1 - t)));
  return `#${m.map((v) => v.toString(16).padStart(2, "0")).join("")}`;
}

function toSkin(p: Palette, name = "", copy?: { headline?: string; sub?: string }): HotelSkin {
  const dark = lum(p.bg) < 0.35;
  return {
    bg: p.bg, ink: p.ink, card: p.card, accent: p.accent,
    accentInk: lum(p.accent) > 0.55 ? "#111111" : "#FFFFFF",
    // Accent used for link-style text: falls back to ink when the accent is too close to the card colour to read.
    accentText: Math.abs(lum(p.accent) - lum(p.card)) >= 0.3 ? p.accent : p.ink,
    muted: p.muted || mix(p.ink, p.bg, 0.55),
    line: p.border || mix(p.ink, p.bg, 0.14),
    // Strong surface for footers / dark feature bands.
    panel: dark ? p.card : (p.surfaceDark || p.ink),
    font: p.font, headlineFont: p.headlineFont, dark,
    variant: HOTEL_VARIANT_BY_NAME[name]?.variant ?? "fullbleed", radius: HOTEL_VARIANT_BY_NAME[name]?.radius ?? "6px",
    homeLayout: HOTEL_VARIANT_BY_NAME[name]?.homeLayout,
    headline: copy?.headline, sub: copy?.sub,
  };
}

/** Skin for the template a store actually chose (never null for a known template). */
export async function resolveHotelSkin(templateName: string): Promise<HotelSkin> {
  const mode = SCREENSHOT_MODE_BY_NAME[templateName];
  if (mode && SCREENSHOT_PALETTES[mode]) return toSkin(SCREENSHOT_PALETTES[mode], templateName);
  // Reference templates (Aspire, Larita, Skyview ...) are NOT known to resolveStoreTheme, which silently
  // fell back to one shared default theme -- so every one of them got the same palette and fonts.
  const { REFERENCE_TEMPLATE_CATALOG } = await import("./reference-template-catalog");
  const ref: any = REFERENCE_TEMPLATE_CATALOG.find((t) => t.variationName === templateName);
  if (ref) return toSkin({ bg: ref.bg, ink: ref.ink, card: ref.card, accent: ref.accent, muted: ref.muted, border: ref.border, font: ref.font, headlineFont: ref.headlineFont, surfaceDark: ref.surfaceDark }, templateName, { headline: ref.headline, sub: ref.sub });
  // Loaded lazily: template-themes imports hotel-content, which imports this file's type.
  const { resolveStoreTheme } = await import("./template-themes");
  const t = resolveStoreTheme(undefined, "", null, null, LEGACY_TARGET_BY_NAME[templateName] || templateName);
  return toSkin({ bg: t.bg, ink: t.ink, card: t.card, accent: t.accent, muted: t.muted, border: t.border, font: t.font, headlineFont: t.headlineFont, surfaceDark: t.surfaceDark }, templateName);
}
