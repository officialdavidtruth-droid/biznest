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
 *   4. "Violet" — purple/indigo commerce layout (topbar, category grid,
 *      product grid, dark footer), ported from violet_store_template.zip
 *      (see components/storefront/templates/violet-home.tsx).
 *   5. "Premium Marketplace" — dense enterprise marketplace layout
 *      (category sidebar, flash sales, product rails, brand/social proof
 *      strips), ported from premium_marketplace_template.zip (see
 *      components/storefront/templates/premium-home.tsx).
 *   6. "HomeVista" — real-estate listing layout (green/teal palette,
 *      search bar, property-type grid, listing cards), ported from
 *      homevista_nextjs_template.zip (see
 *      components/storefront/templates/homevista-home.tsx).
 *   7. "rRW Premium Rental" — dark premium car-rental layout (pill nav,
 *      category grid, fleet cards, benefits strip), ported from
 *      rrw_car_rental_nextjs.zip (see
 *      components/storefront/templates/rrw-home.tsx).
 *   8. "Marketplace Hub" — classic big-box marketplace layout (blue search
 *      bar, category sidebar, service-icon strip, per-category product
 *      rows, sponsored-partners strip, promo sidebar), ported from
 *      marketplace_nextjs_template.zip (see
 *      components/storefront/templates/marketplace-home.tsx).
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

/** ---------- Template 4: "Violet" — purple/indigo commerce layout, ported from violet_store_template.zip ---------- */
export const VIOLET = {
  navy: "#17132d",
  ink: "#181922",
  accent: "#6c3df5",
  lilac: "#d9ceff",
  bg: "#f6f7fb",
  font: "'Inter', sans-serif",
  headlineFont: "'Inter', sans-serif",
  radius: "18px",
} as const;

export const VIOLET_THEME: TemplateTheme = {
  bg: VIOLET.bg,
  ink: VIOLET.ink,
  card: "#ffffff",
  accent: VIOLET.accent,
  font: VIOLET.font,
  headlineFont: VIOLET.headlineFont,
  radius: VIOLET.radius,
  eyebrow: "New Season Collection",
  headline: "Style that feels like you.",
  sub: "Discover products and services selected for everyday living.",
  cta: "Shop now",
  layout: "grid",
  heroStyle: "split",
  catalogLabel: "Shop",
  sections: ["hero", "categories", "catalog", "testimonials", "stats", "newsletter", "contact"],
};

export const TEMPLATE_NAME_VIOLET = "Violet";

export function isVioletTemplate(templateName: string | null | undefined): boolean {
  return templateName === TEMPLATE_NAME_VIOLET;
}

/** ---------- Template 5: "Premium Marketplace" — dense enterprise marketplace layout, ported from premium_marketplace_template.zip ---------- */
export const PREMIUM = {
  topbar: "#eef2f4",
  ink: "#182229",
  accent: "#6c3df5",
  bg: "#f4f8fa",
  hero1: "#6e4a3a",
  hero2: "#a66548",
  hero3: "#e0c2b1",
  side1: "#222628",
  side2: "#98705c",
  font: "Inter, Arial, sans-serif",
  headlineFont: "Inter, Arial, sans-serif",
  radius: "9px",
} as const;

export const PREMIUM_THEME: TemplateTheme = {
  bg: PREMIUM.bg,
  ink: PREMIUM.ink,
  card: "#ffffff",
  accent: PREMIUM.accent,
  font: PREMIUM.font,
  headlineFont: PREMIUM.headlineFont,
  radius: PREMIUM.radius,
  eyebrow: "Seasonal Collection",
  headline: "Elevate Your Style",
  sub: "Enhance your daily essentials with premium seasonal picks.",
  cta: "Shop now",
  layout: "grid",
  heroStyle: "split",
  catalogLabel: "Shop",
  sections: ["hero", "categories", "catalog", "testimonials", "stats", "newsletter", "contact"],
};

export const TEMPLATE_NAME_PREMIUM = "Premium Marketplace";

export function isPremiumTemplate(templateName: string | null | undefined): boolean {
  return templateName === TEMPLATE_NAME_PREMIUM;
}

/** ---------- Template 6: "HomeVista" — real-estate listing layout, ported from homevista_nextjs_template.zip ---------- */
export const HOMEVISTA = {
  topbar: "#f4f7f6",
  ink: "#17282b",
  dark: "#103b37",
  accent: "#178b59",
  footer: "#062e2b",
  font: "Arial, Helvetica, sans-serif",
  headlineFont: "Arial, Helvetica, sans-serif",
  radius: "8px",
} as const;

export const HOMEVISTA_THEME: TemplateTheme = {
  bg: "#ffffff",
  ink: HOMEVISTA.ink,
  card: "#ffffff",
  accent: HOMEVISTA.accent,
  font: HOMEVISTA.font,
  headlineFont: HOMEVISTA.headlineFont,
  radius: HOMEVISTA.radius,
  eyebrow: "Find. Buy. Live Better.",
  headline: "Find Your Dream Home",
  sub: "Explore verified listings and find a place you'll love.",
  cta: "Explore Listings",
  layout: "grid",
  heroStyle: "split",
  catalogLabel: "Listings",
  sections: ["hero", "categories", "catalog", "about", "testimonials", "stats", "newsletter", "contact"],
};

export const TEMPLATE_NAME_HOMEVISTA = "HomeVista";

export function isHomeVistaTemplate(templateName: string | null | undefined): boolean {
  return templateName === TEMPLATE_NAME_HOMEVISTA;
}

/** ---------- Template 7: "rRW" — dark premium car-rental layout, ported from rrw_car_rental_nextjs.zip ---------- */
export const RRW = {
  ink: "#111111",
  accent: "#79a7ff",
  cat0: "#b8c1c6",
  cat1: "#dddddd",
  cat2: "#444444",
  cat3: "#e7e7e7",
  font: "Arial, Helvetica, sans-serif",
  headlineFont: "Arial, Helvetica, sans-serif",
  radius: "3px",
} as const;

export const RRW_THEME: TemplateTheme = {
  bg: "#ffffff",
  ink: RRW.ink,
  card: "#ffffff",
  accent: RRW.accent,
  font: RRW.font,
  headlineFont: RRW.headlineFont,
  radius: RRW.radius,
  eyebrow: "Premium Rental",
  headline: "Premium car rental",
  sub: "A stress-free rental experience with simple search tools and plenty of pick-up locations.",
  cta: "Browse Fleet",
  layout: "grid",
  heroStyle: "fullbleed",
  catalogLabel: "Fleet",
  sections: ["hero", "categories", "catalog", "testimonials", "stats", "newsletter", "contact"],
};

export const TEMPLATE_NAME_RRW = "rRW Premium Rental";

export function isRrwTemplate(templateName: string | null | undefined): boolean {
  return templateName === TEMPLATE_NAME_RRW;
}

/** ---------- Template 8: "Marketplace Hub" — classic big-box marketplace layout, ported from marketplace_nextjs_template.zip ---------- */
export const MARKETPLACE = {
  ink: "#333333",
  blue: "#0583c5",
  blueDark: "#234d70",
  orange: "#f7941d",
  orangeDark: "#e86d19",
  price: "#e94f3d",
  footer: "#2b587d",
  border: "#dddddd",
  font: "Arial, Helvetica, sans-serif",
  headlineFont: "Arial, Helvetica, sans-serif",
  radius: "4px",
} as const;

export const MARKETPLACE_THEME: TemplateTheme = {
  bg: "#ffffff",
  ink: MARKETPLACE.ink,
  card: "#ffffff",
  accent: MARKETPLACE.blue,
  font: MARKETPLACE.font,
  headlineFont: MARKETPLACE.headlineFont,
  radius: MARKETPLACE.radius,
  eyebrow: "Special promotions and free delivery on selected orders",
  headline: "Everything you need, all in one place",
  sub: "Browse the full catalog and shop by category.",
  cta: "Shop Now",
  layout: "grid",
  heroStyle: "fullbleed",
  catalogLabel: "Products",
  sections: ["hero", "categories", "catalog", "testimonials", "stats", "newsletter", "contact"],
};

export const TEMPLATE_NAME_MARKETPLACE = "Marketplace Hub";

export function isMarketplaceTemplate(templateName: string | null | undefined): boolean {
  return templateName === TEMPLATE_NAME_MARKETPLACE;
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

export function generateVioletVariation(): GeneratedTemplate {
  return { ...VIOLET_THEME, variationName: TEMPLATE_NAME_VIOLET, tierRank: 4 };
}

export function generatePremiumVariation(): GeneratedTemplate {
  return { ...PREMIUM_THEME, variationName: TEMPLATE_NAME_PREMIUM, tierRank: 4 };
}

export function generateHomeVistaVariation(): GeneratedTemplate {
  return { ...HOMEVISTA_THEME, variationName: TEMPLATE_NAME_HOMEVISTA, tierRank: 4 };
}

export function generateRrwVariation(): GeneratedTemplate {
  return { ...RRW_THEME, variationName: TEMPLATE_NAME_RRW, tierRank: 4 };
}

export function generateMarketplaceVariation(): GeneratedTemplate {
  return { ...MARKETPLACE_THEME, variationName: TEMPLATE_NAME_MARKETPLACE, tierRank: 4 };
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
  const base = isHeenzyTemplate(templateName)
    ? HEENZY_THEME
    : isNovaTemplate(templateName)
    ? NOVA_THEME
    : isVioletTemplate(templateName)
    ? VIOLET_THEME
    : isPremiumTemplate(templateName)
    ? PREMIUM_THEME
    : isHomeVistaTemplate(templateName)
    ? HOMEVISTA_THEME
    : isRrwTemplate(templateName)
    ? RRW_THEME
    : isMarketplaceTemplate(templateName)
    ? MARKETPLACE_THEME
    : FRESH_THEME;
  return {
    ...base,
    bg: overrides?.secondary || base.bg,
    accent: overrides?.primary || overrides?.accent || base.accent,
    font: fontFamily || base.font,
  };
}
