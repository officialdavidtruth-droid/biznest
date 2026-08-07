/**
 * Storefront template system.
 *
 * The platform ships two storefront templates:
 *   1. "Fresh & Co." — forest green / leaf green / citrus service theme.
 *   2. "Heenzy Sneaker Co." — black / white / yellow retail/catalog theme
 *      (see styles/heenzy-template.css and
 *      components/storefront/templates/heenzy-home.tsx).
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

/** The catalog has exactly two templates: Fresh & Co. (tier 1) and Heenzy Sneaker Co. (tier 2). */
export function generateNicheVariations(_nicheName: string): GeneratedTemplate[] {
  return [{ ...FRESH_THEME, variationName: TEMPLATE_NAME, tierRank: 1 }];
}

export function generateHeenzyVariation(): GeneratedTemplate {
  return { ...HEENZY_THEME, variationName: TEMPLATE_NAME_HEENZY, tierRank: 2 };
}

export function getTemplateTheme(_category: string | undefined, _storeName: string): TemplateTheme {
  return FRESH_THEME;
}

/**
 * ---------- "Fashion & Lifestyle" category (4 templates) ----------
 * All four reuse the shared generic storefront renderer (the same one
 * FRESH_THEME uses in app/store/[slug]/page.tsx) plus the shared, already
 * theme-neutral cart/checkout/payment flow — so every one of them ships
 * with a working landing → catalog → cart → checkout → payment path out
 * of the box. What makes each one distinct is its own palette, hero
 * layout, and section order, matching the request that every template in
 * a category look genuinely different rather than being a recolor.
 */
export const NOVA = {
  bg: "#f5f4fb",
  ink: "#1c1a2e",
  inkSoft: "#6b6880",
  card: "#ffffff",
  primary: "#6c4fe0",
  primaryDark: "#4d33b3",
  accent: "#ff5a7a",
  font: "'Inter', sans-serif",
  headlineFont: "'Inter', sans-serif",
  radius: "16px",
} as const;

/** Template 1 — "NovaShop": bold split hero, purple/coral, dense deal-driven grid (Image: NovaShop dashboard-style storefront). */
export const NOVA_THEME: TemplateTheme = {
  bg: NOVA.bg,
  ink: NOVA.ink,
  card: NOVA.card,
  accent: NOVA.primary,
  font: NOVA.font,
  headlineFont: NOVA.headlineFont,
  radius: NOVA.radius,
  eyebrow: "New Collection",
  headline: "Find Your Style, Love Your Look",
  sub: "Discover the latest trends in fashion, beauty, and lifestyle — curated deals, refreshed daily.",
  cta: "Shop Now",
  layout: "grid",
  heroStyle: "split",
  catalogLabel: "Best deals for you",
  sections: ["hero", "categories", "deal", "catalog", "stats", "testimonials", "newsletter", "contact"],
};
export const TEMPLATE_NAME_NOVA = "NovaShop";

export const AURORA = {
  bg: "#0b0f0e",
  ink: "#eafff5",
  inkSoft: "#9fb8ae",
  card: "#121816",
  primary: "#39e6a8",
  primaryDark: "#1fae7c",
  accent: "#d9ff4f",
  font: "'Inter', sans-serif",
  headlineFont: "'Inter', sans-serif",
  radius: "14px",
} as const;

/** Template 2 — "Aurora Store": dark mode, teal/lime gradient banners, countdown-driven sale layout. */
export const AURORA_THEME: TemplateTheme = {
  bg: AURORA.bg,
  ink: AURORA.ink,
  card: AURORA.card,
  accent: AURORA.primary,
  font: AURORA.font,
  headlineFont: AURORA.headlineFont,
  radius: AURORA.radius,
  eyebrow: "New Collection",
  headline: "Elevate Your Everyday",
  sub: "Premium products. Timeless design. Experience the perfect blend of style and performance.",
  cta: "Shop Now",
  layout: "grid",
  heroStyle: "fullbleed",
  catalogLabel: "Best selling",
  sections: ["hero", "categories", "catalog", "deal", "stats", "testimonials", "newsletter", "contact"],
};
export const TEMPLATE_NAME_AURORA = "Aurora Store";

export const SHOPEASE = {
  bg: "#fbf7f2",
  ink: "#20241f",
  inkSoft: "#6d6a63",
  card: "#ffffff",
  primary: "#1f3a2a",
  primaryDark: "#122019",
  accent: "#e8622c",
  font: "'Inter', sans-serif",
  headlineFont: "'Plus Jakarta Sans', sans-serif",
  radius: "10px",
} as const;

/** Template 3 — "ShopEase": warm editorial hero banner, category tiles, deal-of-the-day block. */
export const SHOPEASE_THEME: TemplateTheme = {
  bg: SHOPEASE.bg,
  ink: SHOPEASE.ink,
  card: SHOPEASE.card,
  accent: SHOPEASE.accent,
  font: SHOPEASE.font,
  headlineFont: SHOPEASE.headlineFont,
  radius: SHOPEASE.radius,
  eyebrow: "Limited Time Only",
  headline: "Shop More, Save More",
  sub: "Discover amazing deals on your favorite products — best prices guaranteed, fast delivery worldwide.",
  cta: "Explore Collection",
  layout: "grid",
  heroStyle: "centered",
  catalogLabel: "New arrivals",
  sections: ["hero", "features", "categories", "deal", "catalog", "newsletter", "contact"],
};
export const TEMPLATE_NAME_SHOPEASE = "ShopEase";

export const TECHNEST = {
  bg: "#ffffff",
  ink: "#111111",
  inkSoft: "#5c5c5c",
  card: "#f4f4f4",
  primary: "#0d0d0d",
  primaryDark: "#000000",
  accent: "#2fae4e",
  font: "'Inter', sans-serif",
  headlineFont: "'Inter', sans-serif",
  radius: "8px",
} as const;

/** Template 4 — minimal black/white/green catalog-first layout, no hero photo, straight into featured products. */
export const TECHNEST_THEME: TemplateTheme = {
  bg: TECHNEST.bg,
  ink: TECHNEST.ink,
  card: TECHNEST.card,
  accent: TECHNEST.accent,
  font: TECHNEST.font,
  headlineFont: TECHNEST.headlineFont,
  radius: TECHNEST.radius,
  eyebrow: "New In",
  headline: "Top Picks for Your Lifestyle",
  sub: "Explore the latest arrivals and everyday essentials, picked for quality and value.",
  cta: "Shop Now",
  layout: "list",
  heroStyle: "split",
  catalogLabel: "Featured products",
  sections: ["hero", "catalog", "features", "categories", "testimonials", "newsletter", "contact"],
};
export const TEMPLATE_NAME_TECHNEST = "TechNest Lifestyle";

export type FashionTemplateName =
  | typeof TEMPLATE_NAME_NOVA
  | typeof TEMPLATE_NAME_AURORA
  | typeof TEMPLATE_NAME_SHOPEASE
  | typeof TEMPLATE_NAME_TECHNEST;

const FASHION_TEMPLATES: Record<FashionTemplateName, TemplateTheme> = {
  [TEMPLATE_NAME_NOVA]: NOVA_THEME,
  [TEMPLATE_NAME_AURORA]: AURORA_THEME,
  [TEMPLATE_NAME_SHOPEASE]: SHOPEASE_THEME,
  [TEMPLATE_NAME_TECHNEST]: TECHNEST_THEME,
};

export const FASHION_CATEGORY = "Fashion & Lifestyle";

export function isFashionTemplate(templateName: string | null | undefined): templateName is FashionTemplateName {
  return !!templateName && templateName in FASHION_TEMPLATES;
}

export function generateFashionVariations(): GeneratedTemplate[] {
  return [
    { ...NOVA_THEME, variationName: TEMPLATE_NAME_NOVA, tierRank: 1 },
    { ...AURORA_THEME, variationName: TEMPLATE_NAME_AURORA, tierRank: 2 },
    { ...SHOPEASE_THEME, variationName: TEMPLATE_NAME_SHOPEASE, tierRank: 2 },
    { ...TECHNEST_THEME, variationName: TEMPLATE_NAME_TECHNEST, tierRank: 3 },
  ];
}

/** Merge a store's saved overrides (from Settings) on top of its selected template's default. */
export function resolveStoreTheme(
  _templateCategory: string | undefined,
  _storeName: string,
  overrides: { primary?: string; secondary?: string; accent?: string } | null | undefined,
  fontFamily: string | null | undefined,
  templateName?: string | null
): TemplateTheme {
  const base = isHeenzyTemplate(templateName)
    ? HEENZY_THEME
    : isFashionTemplate(templateName)
    ? FASHION_TEMPLATES[templateName]
    : FRESH_THEME;
  return {
    ...base,
    bg: overrides?.secondary || base.bg,
    accent: overrides?.primary || overrides?.accent || base.accent,
    font: fontFamily || base.font,
  };
}