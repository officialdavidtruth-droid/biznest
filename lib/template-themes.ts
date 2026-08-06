/**
 * Storefront template system.
 *
 * Every store on the platform renders with the same Lumina design system
 * (see the `LUMINA` constants below) — one shared palette, type ramp and
 * shape language. The platform now ships a single curated template
 * ("Cleaning & Home Services", modeled on the Fresh & Co. reference
 * design) instead of a gallery of niches — see `NICHE_TEMPLATES` below.
 * The generation machinery (hero-layout variations, tier gating) is kept
 * so that one template still yields a few real, selectable variations
 * rather than a single static page.
 *
 * How the count is produced: for the template, combine
 *   N "variant" slots (one per accent it defines, now just a stable way
 *     to keep catalog size/tier spread reproducible)
 *   × 3 hero layouts (centered / split / fullbleed)
 *
 * Tier gating: templates are assigned a tierRank (1-4) cycling through the
 * generated list, so every tier — including Free — has real choices, and
 * each tier up unlocks more. Keep in sync with prisma/seed.ts's
 * SUBSCRIPTIONS features.templateTier.
 */

export type HeroStyle = "centered" | "split" | "fullbleed";
export type Section = "hero" | "catalog" | "about" | "testimonials" | "contact" | "stats" | "features" | "newsletter" | "categories" | "deal" | "gallery";

/**
 * Lumina design system — the single storefront look shared by every store
 * on the platform, retuned to the Fresh & Co. reference design: forest
 * green + leaf green with a citrus-gold accent, generous pill/card
 * radius, Plus Jakarta Sans headlines over Inter body text.
 */
export const LUMINA = {
  bg: "#FFFFFF", // surface
  bgDim: "#F7F8F6", // surface-container-low — alternating section bg (paper)
  ink: "#16211C", // on-surface
  inkMuted: "#67766D", // on-surface-variant
  card: "#FFFFFF", // surface-container-lowest
  cardAlt: "#EEFAF1", // surface-container (mint)
  inverse: "#123524", // inverse-surface — dark "power block" sections (forest)
  inverseInk: "#EEFAF1", // inverse-on-surface
  accent: "#3AAB61", // primary — leaf green
  accentBright: "#4FC274", // primary-container — leaf light
  citrus: "#F2B134", // secondary accent — ratings, badges, highlights
  outline: "#D8DED9", // outline-variant
  font: "'Inter', sans-serif", // body/UI
  headlineFont: "'Plus Jakarta Sans', sans-serif", // display/headline
  radius: "1.5rem", // container radius (cards/media)
  radiusSm: "1rem", // input/small control radius
} as const;

export type TemplateTheme = {
  bg: string;
  ink: string;
  card: string;
  accent: string;
  font: string;
  headlineFont: string;
  radius: string;
  eyebrow: string;
  headline: string;
  sub: string;
  cta: string;
  layout: "grid" | "list";
  heroStyle: HeroStyle;
  catalogLabel: string;
  sections: Section[];
};

export type NicheBase = {
  bg: string;
  ink: string;
  card: string;
  accent: string;
  altAccents: string[]; // extra variant slots — each one adds 3 more hero-layout templates
  font: string;
  radius: string;
  eyebrow: string;
  headline: string;
  sub: string;
  cta: string;
  layout: "grid" | "list";
  catalogLabel: string;
  sections: Section[];
};

export type GeneratedTemplate = TemplateTheme & {
  variationName: string; // e.g. "Midnight · Split"
  tierRank: 1 | 2 | 3 | 4;
};

const HERO_STYLES: HeroStyle[] = ["centered", "split", "fullbleed"];

export const NICHE_TEMPLATES: Record<string, NicheBase> = {
  "Cleaning & Home Services": {
    bg: "#FFFFFF", ink: "#16211C", card: "#FFFFFF", accent: "#3AAB61", altAccents: [],
    font: "'Inter', sans-serif", radius: "1.5rem",
    eyebrow: "Professional Cleaning Agency",
    headline: "Professional Cleaning Services",
    sub: "Professional cleaning services for offices, homes, and commercial spaces \u2014 done right, every time.",
    cta: "Our Services",
    layout: "grid", catalogLabel: "Services",
    sections: ["hero", "features", "catalog", "about", "gallery", "stats", "testimonials", "contact", "newsletter"],
  },
};

export const NICHE_NAMES = Object.keys(NICHE_TEMPLATES);

/** Generates every selectable template for one niche — see file header for the formula. */
export function generateNicheVariations(nicheName: string): GeneratedTemplate[] {
  const base = NICHE_TEMPLATES[nicheName];
  if (!base) return [];

  // Every "combo" is now a Lumina-themed template — colors, fonts and radius
  // are fixed to the shared design system. Layout/copy still comes from the
  // niche, and hero style is the one real structural variation on offer
  // (kept as a loop of the old accent count purely so each niche keeps a
  // stable, reproducible catalog size and tier spread, not because the
  // color changes between entries anymore).
  const variantCount = 1 + base.altAccents.length;

  const combos: GeneratedTemplate[] = [];
  let i = 0;
  for (let v = 0; v < variantCount; v++) {
    for (const heroStyle of HERO_STYLES) {
      const tierRank = ((Math.floor(i / 2) % 4) + 1) as 1 | 2 | 3 | 4; // cycles 1,1,2,2,3,3,4,4,...
      combos.push({
        bg: LUMINA.bg,
        ink: LUMINA.ink,
        card: LUMINA.card,
        accent: LUMINA.accent,
        font: LUMINA.font,
        headlineFont: LUMINA.headlineFont,
        radius: LUMINA.radius,
        eyebrow: base.eyebrow,
        headline: base.headline,
        sub: base.sub,
        cta: base.cta,
        layout: base.layout,
        heroStyle,
        catalogLabel: base.catalogLabel,
        sections: base.sections,
        variationName: `Lumina · ${heroStyle}${variantCount > 1 ? ` · ${v + 1}` : ""}`,
        tierRank,
      });
      i++;
    }
  }
  return combos;
}

// Deterministic fallback for a category with no curated base (shouldn't
// happen with the one above, but keeps rendering safe if it's ever missing).
function hashString(s: string): number {
  let h = 0;
  for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) >>> 0;
  return h;
}

function luminaThemeFor(base: NicheBase): TemplateTheme {
  return {
    bg: LUMINA.bg,
    ink: LUMINA.ink,
    card: LUMINA.card,
    accent: LUMINA.accent,
    font: LUMINA.font,
    headlineFont: LUMINA.headlineFont,
    radius: LUMINA.radius,
    eyebrow: base.eyebrow,
    headline: base.headline,
    sub: base.sub,
    cta: base.cta,
    layout: base.layout,
    heroStyle: "centered",
    catalogLabel: base.catalogLabel,
    sections: base.sections,
  };
}

export function getTemplateTheme(category: string | undefined, storeName: string): TemplateTheme {
  if (category && NICHE_TEMPLATES[category]) {
    return luminaThemeFor(NICHE_TEMPLATES[category]);
  }
  const pool = Object.values(NICHE_TEMPLATES);
  const b = pool[hashString(category ?? storeName) % pool.length];
  return luminaThemeFor(b);
}

/** Merge a store's saved overrides (from Settings) on top of the Lumina default. */
export function resolveStoreTheme(
  templateCategory: string | undefined,
  storeName: string,
  overrides: { primary?: string; secondary?: string; accent?: string } | null | undefined,
  fontFamily: string | null | undefined
): TemplateTheme {
  const base = getTemplateTheme(templateCategory, storeName);
  return {
    ...base,
    bg: overrides?.secondary || base.bg,
    ink: base.ink,
    accent: overrides?.primary || overrides?.accent || base.accent,
    font: fontFamily || base.font,
  };
}
