/**
 * Storefront template system.
 *
 * The platform now ships exactly ONE storefront template — the "Fresh & Co"
 * design (forest green / leaf green / citrus, rounded hero banner, service
 * grid, dark story block, steps, testimonials, appointment/quote section).
 * There is no per-niche generation anymore: every store renders with this
 * same theme. Only real store data (name, logo, banner, catalog, reviews,
 * contact info) changes what's shown — copy and layout are fixed.
 */

export type HeroStyle = "centered" | "split" | "fullbleed";
export type Section = "hero" | "catalog" | "about" | "testimonials" | "contact" | "stats" | "features" | "newsletter" | "categories" | "deal";

export const FRESH = {
  forest: "#123524",
  forestDark: "#0d281b",
  leaf: "#3aab61",
  leafLight: "#4fc274",
  mint: "#eefaf1",
  mint2: "#dcf3e2",
  ivory: "#ffffff",
  paper: "#f7f8f6",
  ink: "#16211c",
  inkSoft: "#67766d",
  citrus: "#f2b134",
  font: "'Inter', sans-serif",
  headlineFont: "'Plus Jakarta Sans', sans-serif",
  radius: "1rem",
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

export type GeneratedTemplate = TemplateTheme & {
  variationName: string;
  tierRank: 1 | 2 | 3 | 4;
};

/** The single template theme every store uses. */
export const FRESH_THEME: TemplateTheme = {
  bg: FRESH.ivory,
  ink: FRESH.ink,
  card: FRESH.ivory,
  accent: FRESH.leaf,
  font: FRESH.font,
  headlineFont: FRESH.headlineFont,
  radius: FRESH.radius,
  eyebrow: "Professional Cleaning Agency",
  headline: "Professional Cleaning Services",
  sub: "Professional cleaning services for offices, homes, and commercial spaces — done right, every time.",
  cta: "Our Services",
  layout: "grid",
  heroStyle: "fullbleed",
  catalogLabel: "Services",
  sections: ["hero", "features", "catalog", "about", "testimonials", "contact"],
};

export const TEMPLATE_NAME = "Fresh & Co.";

/** The catalog now always has exactly one template. */
export function generateNicheVariations(_nicheName: string): GeneratedTemplate[] {
  return [{ ...FRESH_THEME, variationName: TEMPLATE_NAME, tierRank: 1 }];
}

export function getTemplateTheme(_category: string | undefined, _storeName: string): TemplateTheme {
  return FRESH_THEME;
}

/** Merge a store's saved overrides (from Settings) on top of the Fresh & Co default. */
export function resolveStoreTheme(
  _templateCategory: string | undefined,
  _storeName: string,
  overrides: { primary?: string; secondary?: string; accent?: string } | null | undefined,
  fontFamily: string | null | undefined
): TemplateTheme {
  return {
    ...FRESH_THEME,
    bg: overrides?.secondary || FRESH_THEME.bg,
    accent: overrides?.primary || overrides?.accent || FRESH_THEME.accent,
    font: fontFamily || FRESH_THEME.font,
  };
}
