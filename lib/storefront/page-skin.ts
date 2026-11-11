/**
 * Presentation-only "page skin" for the transaction pages every template shares (cart, checkout, pay).
 * Payment logic never reads this; it only changes layout order, surfaces, corners, spacing and button shape.
 * Every template gets its own recipe: index in the sorted registry -> mixed-radix tuple, which is injective,
 * so no two templates can share one (enforced by lib/__tests__/page-skin.test.ts).
 */
export type PageLayout = "summary-right" | "summary-left" | "single" | "summary-top" | "wide-form" | "narrow-centre" | "split-bleed";
export type PageSurface = "shadow" | "bordered" | "flat" | "outlined-heavy" | "tinted";
export type PageRadius = "sharp" | "soft" | "round" | "pill";
export type PageDensity = "compact" | "cozy" | "airy";
export type PageSummary = "dark" | "accent" | "paper" | "outline";

export type PageHeader = "line" | "centre" | "band" | "split" | "plain";
export type PageSteps = "dots" | "bar" | "tabs" | "crumbs" | "none";
export type PageItems = "rows" | "cards" | "compact" | "ruled";
export type PageFields = "boxed" | "underline" | "filled" | "pill";
export type PageWeight = "bold" | "light" | "medium";

export type PageSkin = {
  layout: PageLayout; header: PageHeader; steps: PageSteps; items: PageItems; fields: PageFields;
  surface: PageSurface; radius: PageRadius; density: PageDensity; summary: PageSummary; weight: PageWeight;
};

const LAYOUTS = ["summary-right", "summary-left", "single", "summary-top", "wide-form", "narrow-centre", "split-bleed"] as const;
const HEADERS = ["line", "centre", "band", "split", "plain"] as const;
const STEPS = ["dots", "bar", "tabs", "crumbs", "none"] as const;
const ITEMS = ["rows", "cards", "compact", "ruled"] as const;
const FIELDS = ["boxed", "underline", "filled", "pill"] as const;
const SURFACES = ["shadow", "bordered", "flat", "outlined-heavy", "tinted"] as const;
const RADII = ["soft", "sharp", "round", "pill"] as const;
const DENSITIES = ["cozy", "compact", "airy"] as const;
const SUMMARIES = ["dark", "paper", "accent", "outline"] as const;
const WEIGHTS = ["bold", "light", "medium"] as const;
export const SKIN_AXES = { layout: LAYOUTS, header: HEADERS, steps: STEPS, items: ITEMS, fields: FIELDS, surface: SURFACES, radius: RADII, density: DENSITIES, summary: SUMMARIES, weight: WEIGHTS } as const;

/**
 * One recipe per template, generated so that any two templates differ in at least 6 of these 10 settings
 * (lib/__tests__/page-skin.test.ts enforces it). The table is frozen: adding a template must not restyle the
 * stores that already use another one, so a new name is appended here, never re-derived.
 */
export const PAGE_SKIN_TABLE: Record<string, PageSkin> = {
  "Arcova Architecture": { layout: "single", header: "line", steps: "crumbs", items: "ruled", fields: "filled", surface: "flat", radius: "pill", density: "compact", summary: "dark", weight: "light" },
  "Aspire Resort": { layout: "narrow-centre", header: "band", steps: "dots", items: "compact", fields: "underline", surface: "tinted", radius: "round", density: "airy", summary: "outline", weight: "medium" },
  "Atelier — Modern Fashion": { layout: "split-bleed", header: "plain", steps: "bar", items: "cards", fields: "boxed", surface: "shadow", radius: "soft", density: "cozy", summary: "accent", weight: "bold" },
  "Bloom — Beauty Boutique": { layout: "summary-right", header: "split", steps: "none", items: "rows", fields: "pill", surface: "bordered", radius: "sharp", density: "cozy", summary: "paper", weight: "light" },
  "Drive — Cars & Rentals": { layout: "summary-left", header: "centre", steps: "tabs", items: "rows", fields: "underline", surface: "outlined-heavy", radius: "pill", density: "compact", summary: "paper", weight: "bold" },
  "Electra Blue Electronics": { layout: "wide-form", header: "plain", steps: "tabs", items: "ruled", fields: "pill", surface: "outlined-heavy", radius: "sharp", density: "airy", summary: "dark", weight: "medium" },
  "Electra — Smart Commerce": { layout: "summary-top", header: "line", steps: "dots", items: "cards", fields: "filled", surface: "shadow", radius: "round", density: "airy", summary: "accent", weight: "light" },
  "Emarket Furniture & Home": { layout: "summary-top", header: "split", steps: "crumbs", items: "compact", fields: "boxed", surface: "tinted", radius: "soft", density: "compact", summary: "outline", weight: "bold" },
  "Ember — Restaurant": { layout: "single", header: "centre", steps: "bar", items: "ruled", fields: "pill", surface: "bordered", radius: "soft", density: "cozy", summary: "outline", weight: "medium" },
  "Fabtex": { layout: "split-bleed", header: "band", steps: "none", items: "cards", fields: "underline", surface: "flat", radius: "round", density: "compact", summary: "paper", weight: "light" },
  "Forge — Construction": { layout: "wide-form", header: "band", steps: "dots", items: "rows", fields: "filled", surface: "outlined-heavy", radius: "pill", density: "cozy", summary: "accent", weight: "medium" },
  "Frame — Photography Studio": { layout: "narrow-centre", header: "centre", steps: "bar", items: "compact", fields: "boxed", surface: "bordered", radius: "sharp", density: "airy", summary: "dark", weight: "bold" },
  "Fresh & Co.": { layout: "summary-left", header: "plain", steps: "none", items: "rows", fields: "pill", surface: "shadow", radius: "round", density: "compact", summary: "accent", weight: "medium" },
  "Gala — Events & Celebrations": { layout: "summary-right", header: "line", steps: "tabs", items: "ruled", fields: "boxed", surface: "tinted", radius: "soft", density: "airy", summary: "paper", weight: "light" },
  "Grand — Hotel & Hospitality": { layout: "split-bleed", header: "split", steps: "crumbs", items: "cards", fields: "filled", surface: "flat", radius: "sharp", density: "cozy", summary: "outline", weight: "medium" },
  "Harvest — Grocery Market": { layout: "summary-top", header: "line", steps: "tabs", items: "compact", fields: "pill", surface: "flat", radius: "pill", density: "cozy", summary: "accent", weight: "bold" },
  "Haven — Home & Furniture": { layout: "single", header: "split", steps: "none", items: "rows", fields: "filled", surface: "outlined-heavy", radius: "soft", density: "airy", summary: "dark", weight: "bold" },
  "Heenzy Sneaker Co.": { layout: "wide-form", header: "centre", steps: "crumbs", items: "ruled", fields: "underline", surface: "shadow", radius: "round", density: "cozy", summary: "dark", weight: "bold" },
  "Heenzy — Boutique Rose": { layout: "narrow-centre", header: "plain", steps: "dots", items: "cards", fields: "pill", surface: "tinted", radius: "sharp", density: "compact", summary: "paper", weight: "bold" },
  "HomeVista": { layout: "summary-left", header: "line", steps: "bar", items: "compact", fields: "boxed", surface: "outlined-heavy", radius: "round", density: "cozy", summary: "outline", weight: "light" },
  "Horizon": { layout: "summary-right", header: "plain", steps: "crumbs", items: "compact", fields: "underline", surface: "outlined-heavy", radius: "sharp", density: "compact", summary: "accent", weight: "light" },
  "JuiceLife": { layout: "summary-right", header: "band", steps: "tabs", items: "ruled", fields: "filled", surface: "bordered", radius: "round", density: "compact", summary: "accent", weight: "bold" },
  "Kinetic — Sneaker Drop": { layout: "summary-top", header: "split", steps: "bar", items: "rows", fields: "underline", surface: "bordered", radius: "pill", density: "airy", summary: "paper", weight: "medium" },
  "Larita Luxury Hotel": { layout: "wide-form", header: "centre", steps: "none", items: "cards", fields: "filled", surface: "tinted", radius: "pill", density: "airy", summary: "outline", weight: "medium" },
  "Maison — Hotel & Stay": { layout: "single", header: "band", steps: "none", items: "compact", fields: "boxed", surface: "flat", radius: "soft", density: "cozy", summary: "dark", weight: "light" },
  "Marketplace Hub": { layout: "summary-left", header: "line", steps: "dots", items: "cards", fields: "underline", surface: "bordered", radius: "soft", density: "compact", summary: "dark", weight: "medium" },
  "Muse — Salon & Beauty": { layout: "summary-top", header: "band", steps: "crumbs", items: "rows", fields: "pill", surface: "shadow", radius: "sharp", density: "airy", summary: "outline", weight: "light" },
  "Nestoria Real Estate": { layout: "split-bleed", header: "plain", steps: "crumbs", items: "ruled", fields: "boxed", surface: "tinted", radius: "pill", density: "airy", summary: "accent", weight: "medium" },
  "North — Creative Agency": { layout: "narrow-centre", header: "split", steps: "bar", items: "ruled", fields: "filled", surface: "flat", radius: "round", density: "cozy", summary: "paper", weight: "bold" },
  "Nova Studio — Ivory Minimal": { layout: "narrow-centre", header: "centre", steps: "dots", items: "compact", fields: "boxed", surface: "shadow", radius: "pill", density: "compact", summary: "paper", weight: "light" },
  "Nova Studio — Noir": { layout: "summary-right", header: "plain", steps: "tabs", items: "cards", fields: "pill", surface: "shadow", radius: "soft", density: "compact", summary: "dark", weight: "light" },
  "Premium Marketplace": { layout: "single", header: "band", steps: "tabs", items: "compact", fields: "underline", surface: "bordered", radius: "sharp", density: "cozy", summary: "outline", weight: "bold" },
  "Pulse — Fitness & Wellness": { layout: "wide-form", header: "centre", steps: "none", items: "rows", fields: "boxed", surface: "flat", radius: "round", density: "airy", summary: "accent", weight: "bold" },
  "Pure — Cleaning Services": { layout: "summary-left", header: "split", steps: "bar", items: "ruled", fields: "filled", surface: "outlined-heavy", radius: "soft", density: "compact", summary: "accent", weight: "medium" },
  "Rivora Fresh": { layout: "split-bleed", header: "line", steps: "bar", items: "rows", fields: "underline", surface: "tinted", radius: "pill", density: "cozy", summary: "dark", weight: "light" },
  "ShopEase General Store": { layout: "summary-top", header: "band", steps: "dots", items: "ruled", fields: "pill", surface: "shadow", radius: "round", density: "cozy", summary: "paper", weight: "medium" },
  "ShopNova Marketplace": { layout: "narrow-centre", header: "split", steps: "tabs", items: "cards", fields: "boxed", surface: "outlined-heavy", radius: "pill", density: "airy", summary: "outline", weight: "bold" },
  "Skyview Hotels & Resorts": { layout: "wide-form", header: "centre", steps: "crumbs", items: "rows", fields: "filled", surface: "bordered", radius: "sharp", density: "compact", summary: "dark", weight: "medium" },
  "Talent — Recruitment & HR": { layout: "summary-left", header: "plain", steps: "bar", items: "compact", fields: "filled", surface: "flat", radius: "soft", density: "airy", summary: "paper", weight: "light" },
  "TechNova Mobile Store": { layout: "split-bleed", header: "line", steps: "none", items: "cards", fields: "pill", surface: "outlined-heavy", radius: "soft", density: "compact", summary: "outline", weight: "bold" },
  "TechVerse Gadgets": { layout: "single", header: "centre", steps: "tabs", items: "cards", fields: "underline", surface: "tinted", radius: "sharp", density: "airy", summary: "accent", weight: "light" },
  "Transit — Logistics & Delivery": { layout: "narrow-centre", header: "plain", steps: "dots", items: "rows", fields: "underline", surface: "shadow", radius: "sharp", density: "cozy", summary: "dark", weight: "medium" },
  "Violet": { layout: "summary-right", header: "line", steps: "dots", items: "ruled", fields: "pill", surface: "bordered", radius: "sharp", density: "airy", summary: "outline", weight: "bold" },
  "Violet — Sunset": { layout: "summary-right", header: "split", steps: "bar", items: "compact", fields: "boxed", surface: "flat", radius: "round", density: "compact", summary: "dark", weight: "medium" },
  "Vitalis — Clinic & Care": { layout: "summary-left", header: "band", steps: "crumbs", items: "ruled", fields: "underline", surface: "outlined-heavy", radius: "soft", density: "cozy", summary: "paper", weight: "light" },
  "Wanderly Travel": { layout: "wide-form", header: "split", steps: "tabs", items: "compact", fields: "filled", surface: "tinted", radius: "pill", density: "cozy", summary: "paper", weight: "light" },
  "rRW Premium Rental": { layout: "single", header: "band", steps: "dots", items: "cards", fields: "pill", surface: "bordered", radius: "pill", density: "compact", summary: "outline", weight: "light" },
};

export const DEFAULT_PAGE_SKIN: PageSkin = { layout: "summary-right", header: "line", steps: "dots", items: "rows", fields: "boxed", surface: "shadow", radius: "round", density: "cozy", summary: "dark", weight: "bold" };

export const skinTuple = (s: PageSkin) => (Object.keys(SKIN_AXES) as (keyof PageSkin)[]).map((k) => s[k]);
export const skinKey = (s: PageSkin) => skinTuple(s).join("|");
export const skinDistance = (a: PageSkin, b: PageSkin) => skinTuple(a).filter((v, i) => v !== skinTuple(b)[i]).length;

export const TITLE_WEIGHT: Record<PageWeight, string> = { bold: "font-extrabold", medium: "font-semibold", light: "font-light" };
export const TITLE_TRACK: Record<PageWeight, string> = { bold: "-0.01em", medium: "0", light: "0.02em" };

/** Input look for the checkout form. */
export function fieldStyle(s: PageSkin, ink: string, surface: string, card: string): React.CSSProperties {
  switch (s.fields) {
    case "underline": return { color: ink, background: "transparent", border: "none", borderBottom: `1.5px solid ${ink}55`, borderRadius: 0, paddingLeft: 2 };
    case "filled": return { color: ink, background: `${ink}0d`, border: "1px solid transparent", borderRadius: RADIUS_PX[s.radius] };
    case "pill": return { color: ink, background: card, border: `1px solid ${ink}33`, borderRadius: 999, paddingLeft: 18 };
    default: return { color: ink, background: surface, border: `1px solid ${ink}33`, borderRadius: s.radius === "sharp" ? 2 : 8 };
  }
}

export const RADIUS_PX: Record<PageRadius, string> = { sharp: "2px", soft: "10px", round: "20px", pill: "28px" };
export const BTN_RADIUS: Record<PageRadius, string> = { sharp: "0px", soft: "8px", round: "14px", pill: "999px" };
export const PAD: Record<PageDensity, string> = { compact: "p-4", cozy: "p-6", airy: "p-8" };
export const GAP: Record<PageDensity, string> = { compact: "gap-4", cozy: "gap-8", airy: "gap-12" };

export function surfaceStyle(s: PageSkin, ink: string, card: string, surface: string, accent: string): React.CSSProperties {
  const r = RADIUS_PX[s.radius];
  switch (s.surface) {
    case "bordered": return { background: card, border: `1px solid ${ink}26`, borderRadius: r };
    case "flat": return { background: `${ink}08`, borderRadius: r };
    case "outlined-heavy": return { background: surface, border: `2px solid ${ink}`, borderRadius: r };
    case "tinted": return { background: `${accent}12`, border: `1px solid ${accent}33`, borderRadius: r };
    default: return { background: card, boxShadow: "0 8px 30px rgba(0,0,0,0.08)", borderRadius: r };
  }
}

export function summaryStyle(s: PageSkin, p: { ink: string; accent: string; onAccent: string; inverse: string; inverseInk: string; surface: string; card: string }): { style: React.CSSProperties; fg: string } {
  const r = RADIUS_PX[s.radius];
  switch (s.summary) {
    case "accent": return { style: { background: p.accent, color: p.onAccent, borderRadius: r }, fg: p.onAccent };
    case "paper": return { style: { background: p.card, color: p.ink, border: `1px dashed ${p.ink}55`, borderRadius: r }, fg: p.ink };
    case "outline": return { style: { background: "transparent", color: p.ink, border: `2px solid ${p.accent}`, borderRadius: r }, fg: p.ink };
    default: return { style: { background: p.inverse, color: p.inverseInk, borderRadius: r, boxShadow: "0 20px 50px rgba(0,0,0,0.15)" }, fg: p.inverseInk };
  }
}

/** Grid + column classes (literal strings so Tailwind keeps them). [grid, formCol, summaryCol] */
export const LAYOUT_CLASSES: Record<PageLayout, [string, string, string]> = {
  "summary-right": ["grid lg:grid-cols-12", "lg:col-span-7", "lg:col-span-5"],
  "summary-left": ["grid lg:grid-cols-12", "lg:col-span-7 lg:order-2", "lg:col-span-5 lg:order-1"],
  single: ["flex flex-col mx-auto max-w-2xl", "", "order-first"],
  "summary-top": ["flex flex-col", "", "order-first"],
  "wide-form": ["grid lg:grid-cols-12", "lg:col-span-8", "lg:col-span-4"],
  "narrow-centre": ["grid mx-auto max-w-3xl lg:grid-cols-5", "lg:col-span-3", "lg:col-span-2"],
  "split-bleed": ["grid lg:grid-cols-2", "", "lg:order-first"],
};
