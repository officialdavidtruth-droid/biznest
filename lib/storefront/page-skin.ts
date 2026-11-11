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
export type PageGallery = "left" | "right" | "stacked" | "thumbs-side" | "tall" | "wide";
export type PageBuybox = "plain" | "card" | "sticky";
export type PageGrid = "dense" | "regular" | "roomy" | "feature";
export type PageCards = "plain" | "framed" | "lifted" | "tinted";

export type PageSkin = {
  layout: PageLayout; header: PageHeader; steps: PageSteps; items: PageItems; fields: PageFields;
  surface: PageSurface; radius: PageRadius; density: PageDensity; summary: PageSummary; weight: PageWeight;
  gallery: PageGallery; buybox: PageBuybox; grid: PageGrid; cards: PageCards;
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
const GALLERIES = ["left", "right", "stacked", "thumbs-side", "tall", "wide"] as const;
const BUYBOXES = ["plain", "card", "sticky"] as const;
const GRIDS = ["dense", "regular", "roomy", "feature"] as const;
const CARDS = ["plain", "framed", "lifted", "tinted"] as const;
export const SKIN_AXES = { layout: LAYOUTS, header: HEADERS, steps: STEPS, items: ITEMS, fields: FIELDS, surface: SURFACES, radius: RADII, density: DENSITIES, summary: SUMMARIES, weight: WEIGHTS, gallery: GALLERIES, buybox: BUYBOXES, grid: GRIDS, cards: CARDS } as const;

/**
 * One recipe per template, generated so that any two templates differ in at least 8 of these 14 settings
 * (lib/__tests__/page-skin.test.ts enforces it). The table is frozen: adding a template must not restyle the
 * stores that already use another one, so a new name is appended here, never re-derived.
 */
export const PAGE_SKIN_TABLE: Record<string, PageSkin> = {
  "Arcova Architecture": { layout: "single", header: "line", steps: "crumbs", items: "ruled", fields: "filled", surface: "flat", radius: "pill", density: "compact", summary: "dark", weight: "light", gallery: "thumbs-side", buybox: "sticky", grid: "feature", cards: "tinted" },
  "Aspire Resort": { layout: "narrow-centre", header: "band", steps: "dots", items: "compact", fields: "underline", surface: "tinted", radius: "round", density: "airy", summary: "outline", weight: "medium", gallery: "stacked", buybox: "card", grid: "roomy", cards: "lifted" },
  "Atelier — Modern Fashion": { layout: "split-bleed", header: "plain", steps: "bar", items: "cards", fields: "boxed", surface: "shadow", radius: "soft", density: "cozy", summary: "accent", weight: "bold", gallery: "left", buybox: "plain", grid: "dense", cards: "plain" },
  "Bloom — Beauty Boutique": { layout: "summary-right", header: "split", steps: "none", items: "rows", fields: "pill", surface: "bordered", radius: "sharp", density: "cozy", summary: "paper", weight: "light", gallery: "wide", buybox: "card", grid: "regular", cards: "framed" },
  "Drive — Cars & Rentals": { layout: "summary-left", header: "centre", steps: "tabs", items: "rows", fields: "underline", surface: "outlined-heavy", radius: "pill", density: "compact", summary: "paper", weight: "bold", gallery: "right", buybox: "plain", grid: "feature", cards: "framed" },
  "Electra Blue Electronics": { layout: "wide-form", header: "plain", steps: "tabs", items: "ruled", fields: "pill", surface: "outlined-heavy", radius: "sharp", density: "airy", summary: "dark", weight: "medium", gallery: "tall", buybox: "sticky", grid: "roomy", cards: "plain" },
  "Electra — Smart Commerce": { layout: "summary-top", header: "line", steps: "dots", items: "cards", fields: "filled", surface: "shadow", radius: "round", density: "airy", summary: "accent", weight: "light", gallery: "thumbs-side", buybox: "plain", grid: "regular", cards: "lifted" },
  "Emarket Furniture & Home": { layout: "summary-top", header: "split", steps: "crumbs", items: "compact", fields: "boxed", surface: "tinted", radius: "soft", density: "compact", summary: "outline", weight: "bold", gallery: "tall", buybox: "sticky", grid: "regular", cards: "framed" },
  "Ember — Restaurant": { layout: "single", header: "centre", steps: "bar", items: "ruled", fields: "pill", surface: "bordered", radius: "soft", density: "cozy", summary: "outline", weight: "medium", gallery: "stacked", buybox: "card", grid: "dense", cards: "tinted" },
  "Fabtex": { layout: "split-bleed", header: "band", steps: "none", items: "cards", fields: "underline", surface: "flat", radius: "round", density: "compact", summary: "paper", weight: "light", gallery: "wide", buybox: "plain", grid: "roomy", cards: "plain" },
  "Forge — Construction": { layout: "wide-form", header: "band", steps: "dots", items: "rows", fields: "filled", surface: "outlined-heavy", radius: "pill", density: "cozy", summary: "accent", weight: "medium", gallery: "left", buybox: "sticky", grid: "feature", cards: "lifted" },
  "Frame — Photography Studio": { layout: "narrow-centre", header: "centre", steps: "bar", items: "compact", fields: "boxed", surface: "bordered", radius: "sharp", density: "airy", summary: "dark", weight: "bold", gallery: "right", buybox: "sticky", grid: "feature", cards: "tinted" },
  "Fresh & Co.": { layout: "summary-left", header: "plain", steps: "none", items: "rows", fields: "pill", surface: "shadow", radius: "round", density: "compact", summary: "accent", weight: "medium", gallery: "tall", buybox: "card", grid: "dense", cards: "lifted" },
  "Gala — Events & Celebrations": { layout: "summary-right", header: "line", steps: "tabs", items: "ruled", fields: "boxed", surface: "tinted", radius: "soft", density: "airy", summary: "paper", weight: "light", gallery: "right", buybox: "card", grid: "dense", cards: "plain" },
  "Grand — Hotel & Hospitality": { layout: "split-bleed", header: "split", steps: "crumbs", items: "cards", fields: "filled", surface: "flat", radius: "sharp", density: "cozy", summary: "outline", weight: "medium", gallery: "stacked", buybox: "plain", grid: "feature", cards: "framed" },
  "Harvest — Grocery Market": { layout: "summary-top", header: "line", steps: "tabs", items: "compact", fields: "pill", surface: "flat", radius: "pill", density: "cozy", summary: "accent", weight: "bold", gallery: "left", buybox: "card", grid: "regular", cards: "tinted" },
  "Haven — Home & Furniture": { layout: "single", header: "split", steps: "none", items: "rows", fields: "filled", surface: "outlined-heavy", radius: "soft", density: "airy", summary: "dark", weight: "bold", gallery: "wide", buybox: "plain", grid: "roomy", cards: "tinted" },
  "Heenzy Sneaker Co.": { layout: "wide-form", header: "centre", steps: "crumbs", items: "ruled", fields: "underline", surface: "shadow", radius: "round", density: "cozy", summary: "dark", weight: "bold", gallery: "stacked", buybox: "sticky", grid: "regular", cards: "lifted" },
  "Heenzy — Boutique Rose": { layout: "narrow-centre", header: "plain", steps: "dots", items: "cards", fields: "pill", surface: "tinted", radius: "sharp", density: "compact", summary: "paper", weight: "bold", gallery: "thumbs-side", buybox: "card", grid: "feature", cards: "plain" },
  "HomeVista": { layout: "summary-left", header: "line", steps: "bar", items: "compact", fields: "boxed", surface: "outlined-heavy", radius: "round", density: "cozy", summary: "outline", weight: "light", gallery: "thumbs-side", buybox: "sticky", grid: "roomy", cards: "plain" },
  "Horizon": { layout: "summary-right", header: "plain", steps: "crumbs", items: "compact", fields: "underline", surface: "outlined-heavy", radius: "sharp", density: "compact", summary: "accent", weight: "light", gallery: "stacked", buybox: "plain", grid: "dense", cards: "tinted" },
  "JuiceLife": { layout: "summary-right", header: "band", steps: "tabs", items: "ruled", fields: "filled", surface: "bordered", radius: "round", density: "compact", summary: "accent", weight: "bold", gallery: "wide", buybox: "sticky", grid: "dense", cards: "framed" },
  "Kinetic — Sneaker Drop": { layout: "summary-top", header: "split", steps: "bar", items: "rows", fields: "underline", surface: "bordered", radius: "pill", density: "airy", summary: "paper", weight: "medium", gallery: "thumbs-side", buybox: "sticky", grid: "dense", cards: "plain" },
  "Larita Luxury Hotel": { layout: "wide-form", header: "centre", steps: "none", items: "cards", fields: "filled", surface: "tinted", radius: "pill", density: "airy", summary: "outline", weight: "medium", gallery: "right", buybox: "card", grid: "regular", cards: "framed" },
  "Maison — Hotel & Stay": { layout: "single", header: "band", steps: "none", items: "compact", fields: "boxed", surface: "flat", radius: "soft", density: "cozy", summary: "dark", weight: "light", gallery: "left", buybox: "plain", grid: "feature", cards: "lifted" },
  "Marketplace Hub": { layout: "summary-left", header: "line", steps: "dots", items: "cards", fields: "underline", surface: "bordered", radius: "soft", density: "compact", summary: "dark", weight: "medium", gallery: "left", buybox: "sticky", grid: "roomy", cards: "framed" },
  "Muse — Salon & Beauty": { layout: "summary-top", header: "band", steps: "crumbs", items: "rows", fields: "pill", surface: "shadow", radius: "sharp", density: "airy", summary: "outline", weight: "light", gallery: "tall", buybox: "card", grid: "roomy", cards: "tinted" },
  "Nestoria Real Estate": { layout: "split-bleed", header: "plain", steps: "crumbs", items: "ruled", fields: "boxed", surface: "tinted", radius: "pill", density: "airy", summary: "accent", weight: "medium", gallery: "tall", buybox: "plain", grid: "regular", cards: "lifted" },
  "North — Creative Agency": { layout: "narrow-centre", header: "split", steps: "bar", items: "ruled", fields: "filled", surface: "flat", radius: "round", density: "cozy", summary: "paper", weight: "bold", gallery: "right", buybox: "plain", grid: "dense", cards: "lifted" },
  "Nova Studio — Ivory Minimal": { layout: "narrow-centre", header: "centre", steps: "dots", items: "compact", fields: "boxed", surface: "shadow", radius: "pill", density: "compact", summary: "paper", weight: "light", gallery: "wide", buybox: "card", grid: "roomy", cards: "framed" },
  "Nova Studio — Noir": { layout: "summary-right", header: "plain", steps: "tabs", items: "cards", fields: "pill", surface: "shadow", radius: "soft", density: "compact", summary: "dark", weight: "light", gallery: "right", buybox: "sticky", grid: "regular", cards: "tinted" },
  "Premium Marketplace": { layout: "single", header: "band", steps: "tabs", items: "compact", fields: "underline", surface: "bordered", radius: "sharp", density: "cozy", summary: "outline", weight: "bold", gallery: "wide", buybox: "card", grid: "feature", cards: "plain" },
  "Pulse — Fitness & Wellness": { layout: "wide-form", header: "centre", steps: "none", items: "rows", fields: "boxed", surface: "flat", radius: "round", density: "airy", summary: "accent", weight: "bold", gallery: "tall", buybox: "plain", grid: "feature", cards: "plain" },
  "Pure — Cleaning Services": { layout: "summary-left", header: "split", steps: "bar", items: "ruled", fields: "filled", surface: "outlined-heavy", radius: "soft", density: "compact", summary: "accent", weight: "medium", gallery: "thumbs-side", buybox: "plain", grid: "regular", cards: "framed" },
  "Rivora Fresh": { layout: "split-bleed", header: "line", steps: "bar", items: "rows", fields: "underline", surface: "tinted", radius: "pill", density: "cozy", summary: "dark", weight: "light", gallery: "stacked", buybox: "card", grid: "dense", cards: "lifted" },
  "ShopEase General Store": { layout: "summary-top", header: "band", steps: "dots", items: "ruled", fields: "pill", surface: "shadow", radius: "round", density: "cozy", summary: "paper", weight: "medium", gallery: "left", buybox: "plain", grid: "roomy", cards: "framed" },
  "ShopNova Marketplace": { layout: "narrow-centre", header: "split", steps: "tabs", items: "cards", fields: "boxed", surface: "outlined-heavy", radius: "pill", density: "airy", summary: "outline", weight: "bold", gallery: "stacked", buybox: "sticky", grid: "dense", cards: "lifted" },
  "Skyview Hotels & Resorts": { layout: "wide-form", header: "centre", steps: "crumbs", items: "rows", fields: "filled", surface: "bordered", radius: "sharp", density: "compact", summary: "dark", weight: "medium", gallery: "tall", buybox: "plain", grid: "regular", cards: "tinted" },
  "Talent — Recruitment & HR": { layout: "summary-left", header: "plain", steps: "bar", items: "compact", fields: "filled", surface: "flat", radius: "soft", density: "airy", summary: "paper", weight: "light", gallery: "left", buybox: "card", grid: "roomy", cards: "tinted" },
  "TechNova Mobile Store": { layout: "split-bleed", header: "line", steps: "none", items: "cards", fields: "pill", surface: "outlined-heavy", radius: "soft", density: "compact", summary: "outline", weight: "bold", gallery: "wide", buybox: "card", grid: "regular", cards: "lifted" },
  "TechVerse Gadgets": { layout: "single", header: "centre", steps: "tabs", items: "cards", fields: "underline", surface: "tinted", radius: "sharp", density: "airy", summary: "accent", weight: "light", gallery: "thumbs-side", buybox: "sticky", grid: "feature", cards: "framed" },
  "Transit — Logistics & Delivery": { layout: "narrow-centre", header: "plain", steps: "dots", items: "rows", fields: "underline", surface: "shadow", radius: "sharp", density: "cozy", summary: "dark", weight: "medium", gallery: "wide", buybox: "sticky", grid: "dense", cards: "tinted" },
  "Violet": { layout: "summary-right", header: "line", steps: "dots", items: "ruled", fields: "pill", surface: "bordered", radius: "sharp", density: "airy", summary: "outline", weight: "bold", gallery: "left", buybox: "plain", grid: "regular", cards: "plain" },
  "Violet — Sunset": { layout: "summary-right", header: "split", steps: "bar", items: "compact", fields: "boxed", surface: "flat", radius: "round", density: "compact", summary: "dark", weight: "medium", gallery: "stacked", buybox: "card", grid: "feature", cards: "plain" },
  "Vitalis — Clinic & Care": { layout: "summary-left", header: "band", steps: "crumbs", items: "ruled", fields: "underline", surface: "outlined-heavy", radius: "soft", density: "cozy", summary: "paper", weight: "light", gallery: "tall", buybox: "sticky", grid: "dense", cards: "framed" },
  "Wanderly Travel": { layout: "wide-form", header: "split", steps: "tabs", items: "compact", fields: "filled", surface: "tinted", radius: "pill", density: "cozy", summary: "paper", weight: "light", gallery: "stacked", buybox: "plain", grid: "roomy", cards: "plain" },
  "rRW Premium Rental": { layout: "single", header: "band", steps: "dots", items: "cards", fields: "pill", surface: "bordered", radius: "pill", density: "compact", summary: "outline", weight: "light", gallery: "right", buybox: "plain", grid: "dense", cards: "lifted" },
};

export const DEFAULT_PAGE_SKIN: PageSkin = { layout: "summary-right", header: "line", steps: "dots", items: "rows", fields: "boxed", surface: "shadow", radius: "round", density: "cozy", summary: "dark", weight: "bold", gallery: "left", buybox: "plain", grid: "regular", cards: "plain" };

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

/** CSS custom properties for a product page / shop grid, written onto the wrapper element. */
export const GRID_MIN: Record<PageGrid, number> = { dense: 180, regular: 240, roomy: 300, feature: 380 };
export const GRID_GAP: Record<PageGrid, number> = { dense: 14, regular: 28, roomy: 36, feature: 44 };
