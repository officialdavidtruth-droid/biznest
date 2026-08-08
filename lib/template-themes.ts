/**
 * Storefront template system.
 *
 * The platform ships three storefront templates:
 *   1. "Fresh & Co." — forest green / leaf green / citrus service theme.
 *   2. "Heenzy Sneaker Co." — black / white / yellow retail/catalog theme
 *      (see styles/heenzy-template.css and
 *      components/storefront/templates/heenzy-home.tsx).
 *   3. "Nova Studio" — dark, editorial/magazine layout with a sticky side
 *      nav and serif display type (see
 *      components/storefront/templates/nova-home.tsx). Structurally
 *      different from the other two, not just a palette swap.
 * A store picks one from the Template Gallery in its dashboard; only real
 * store data (name, logo, banner, catalog, reviews, contact info) changes
 * what's shown inside whichever template is selected — copy and layout are
 * fixed per template.
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

/** ---------- Template 2: "Heenzy Sneaker Co." ---------- */
export const HEENZY = {
  black: "#0d0d0d",
  charcoal: "#1a1a1a",
  white: "#ffffff",
  offwhite: "#f7f7f7",
  yellow: "#f4c60d",
  gray: "#6b6b6b",
  font: "'Inter', sans-serif",
  headlineFont: "'Inter', sans-serif",
  radius: "14px",
} as const;

export const HEENZY_THEME: TemplateTheme = {
  bg: HEENZY.white,
  ink: HEENZY.black,
  card: HEENZY.white,
  accent: HEENZY.yellow,
  font: HEENZY.font,
  headlineFont: HEENZY.headlineFont,
  radius: HEENZY.radius,
  eyebrow: "Step Into Greatness",
  headline: "Comfort Reimagined",
  sub: "Built for every mood, every move, and every milestone. Unleash the lifestyle in you.",
  cta: "Shop Now",
  layout: "grid",
  heroStyle: "fullbleed",
  catalogLabel: "Products",
  sections: ["hero", "categories", "catalog", "about", "stats", "testimonials", "newsletter", "contact"],
};

export const TEMPLATE_NAME_HEENZY = "Heenzy Sneaker Co.";

export function isHeenzyTemplate(templateName: string | null | undefined): boolean {
  return templateName === TEMPLATE_NAME_HEENZY;
}

/** ---------- Template 3: "Nova Studio" — dark editorial/magazine layout ---------- */
export const NOVA = {
  black: "#0a0a0c",
  charcoal: "#141417",
  cream: "#f5f2ea",
  offwhite: "#faf9f6",
  gold: "#c9a24b",
  gray: "#8a8a8f",
  line: "rgba(245,242,234,0.14)",
  font: "'Inter', sans-serif",
  headlineFont: "'Playfair Display', serif",
  radius: "2px",
} as const;

export const NOVA_THEME: TemplateTheme = {
  bg: NOVA.black,
  ink: NOVA.cream,
  card: NOVA.charcoal,
  accent: NOVA.gold,
  font: NOVA.font,
  headlineFont: NOVA.headlineFont,
  radius: NOVA.radius,
  eyebrow: "Est. — Crafted with Intention",
  headline: "Where Craft Meets Character",
  sub: "A studio built on precision, patience, and a refusal to cut corners. Every piece tells you why.",
  cta: "Explore the Collection",
  layout: "list",
  heroStyle: "split",
  catalogLabel: "The Collection",
  sections: ["hero", "about", "catalog", "testimonials", "stats", "newsletter", "contact"],
};

export const TEMPLATE_NAME_NOVA = "Nova Studio";

export function isNovaTemplate(templateName: string | null | undefined): boolean {
  return templateName === TEMPLATE_NAME_NOVA;
}

/** The catalog has exactly two templates: Fresh & Co. (tier 1) and Heenzy Sneaker Co. (tier 2). */
export function generateNicheVariations(_nicheName: string): GeneratedTemplate[] {
  return [{ ...FRESH_THEME, variationName: TEMPLATE_NAME, tierRank: 1 }];
}

export function generateHeenzyVariation(): GeneratedTemplate {
  return { ...HEENZY_THEME, variationName: TEMPLATE_NAME_HEENZY, tierRank: 2 };
}

export function generateNovaVariation(): GeneratedTemplate {
  return { ...NOVA_THEME, variationName: TEMPLATE_NAME_NOVA, tierRank: 3 };
}

export function getTemplateTheme(_category: string | undefined, _storeName: string): TemplateTheme {
  return FRESH_THEME;
}

/** Merge a store's saved overrides (from Settings) on top of its selected template's default. */
export function resolveStoreTheme(
  _templateCategory: string | undefined,
  _storeName: string,
  overrides: { primary?: string; secondary?: string; accent?: string } | null | undefined,
  fontFamily: string | null | undefined,
  templateName?: string | null
): TemplateTheme {
  const base = isHeenzyTemplate(templateName) ? HEENZY_THEME : isNovaTemplate(templateName) ? NOVA_THEME : FRESH_THEME;
  return {
    ...base,
    bg: overrides?.secondary || base.bg,
    accent: overrides?.primary || overrides?.accent || base.accent,
    font: fontFamily || base.font,
  };
}
