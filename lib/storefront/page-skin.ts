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

export type PageSkin = { layout: PageLayout; surface: PageSurface; radius: PageRadius; density: PageDensity; summary: PageSummary };

const LAYOUTS: PageLayout[] = ["summary-right", "summary-left", "single", "summary-top", "wide-form", "narrow-centre", "split-bleed"];
const SURFACES: PageSurface[] = ["shadow", "bordered", "flat", "outlined-heavy", "tinted"];
const RADII: PageRadius[] = ["soft", "sharp", "round", "pill"];
const DENSITIES: PageDensity[] = ["cozy", "compact", "airy"];
const SUMMARIES: PageSummary[] = ["dark", "paper", "accent", "outline"];

// Strides are coprime with each radix so consecutive templates differ on EVERY axis, not just one.
const AXES = [LAYOUTS, SURFACES, RADII, DENSITIES, SUMMARIES] as const;
const TOTAL = AXES.reduce((n, a) => n * a.length, 1);

export function pageSkinAt(index: number): PageSkin {
  // 211 is prime and does not divide TOTAL, so i -> i*211 mod TOTAL is a bijection on 0..TOTAL-1.
  let n = (index * 211) % TOTAL;
  const pick = <T,>(a: readonly T[]) => { const v = a[n % a.length]; n = Math.floor(n / a.length); return v; };
  return { layout: pick(LAYOUTS), surface: pick(SURFACES), radius: pick(RADII), density: pick(DENSITIES), summary: pick(SUMMARIES) };
}

export const DEFAULT_PAGE_SKIN: PageSkin = { layout: "summary-right", surface: "shadow", radius: "round", density: "cozy", summary: "dark" };

export const skinKey = (s: PageSkin) => `${s.layout}|${s.surface}|${s.radius}|${s.density}|${s.summary}`;

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
