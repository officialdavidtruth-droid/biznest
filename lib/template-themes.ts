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
// "gallery" | "amenities" | "availability" | "map" | "packages" are new,
// added for lib/capabilities.ts — a business type's capabilities determine
// which of these a template is expected to render. Additive only: no
// existing template's `sections` array needs to change to keep working.
export type Section = "hero" | "catalog" | "about" | "testimonials" | "contact" | "stats" | "features" | "newsletter" | "categories" | "deal" | "gallery" | "amenities" | "availability" | "map" | "packages";

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

// Optional "style pack" tokens layered on top of a base template's layout.
// These are what let one component (e.g. NovaStorefront) render genuinely
// different-feeling variants — "Nova Studio — Noir" vs "Nova Studio —
// Ivory Minimal" — from config alone, with no new .tsx file. Every field
// is optional so the 9 templates not yet migrated to read from `theme`
// keep working unchanged (their components still import a hardcoded
// palette const directly); components that DO read these should fall
// back to a sensible constant when a field is absent, never crash on it.
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
  /** Secondary/body text color. Falls back to a muted version of `ink` when unset. */
  muted?: string;
  /** Divider / hairline border color. Falls back to a low-opacity `ink` when unset. */
  border?: string;
  /** Spacing scale — "compact" tightens section padding/gaps for a denser, more minimal feel. Defaults to "relaxed". */
  density?: "compact" | "relaxed";
  /** Strong dark surface for topbars/footers/newsletter bands that are darker than `card` but not literally `ink`. Falls back to `ink` when unset. */
  surfaceDark?: string;
  /** Softer/lighter tint of `accent`, used in gradients and subtle fills. Falls back to `accent` when unset. */
  accentSoft?: string;
  /** Dedicated Professional Services visual system mode. */
  professionalMode?: string;
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
  muted: HEENZY.gray,
  border: "#e7e7e7",
  density: "relaxed",
};

// Second Heenzy variant — same component and CSS file, different config:
// a softer boutique palette (blush accent on off-black instead of street
// yellow-on-black) and "compact" density for tighter cards/spacing. Proves
// the CSS-custom-property approach (theme colors override --hz-* variables
// scoped to .hz-root) works for a stylesheet-based template, not just
// Nova's inline-style one.
const HEENZY_BOUTIQUE = {
  black: "#1c1a1f",
  charcoal: "#2a262d",
  white: "#ffffff",
  offwhite: "#faf6f5",
  accent: "#c98a93",
  gray: "#78727a",
  border: "#ece5e3",
  font: "'Inter', sans-serif",
  headlineFont: "'Playfair Display', serif",
  radius: "6px",
} as const;

export const HEENZY_BOUTIQUE_THEME: TemplateTheme = {
  bg: HEENZY_BOUTIQUE.white,
  ink: HEENZY_BOUTIQUE.black,
  card: HEENZY_BOUTIQUE.offwhite,
  accent: HEENZY_BOUTIQUE.accent,
  font: HEENZY_BOUTIQUE.font,
  headlineFont: HEENZY_BOUTIQUE.headlineFont,
  radius: HEENZY_BOUTIQUE.radius,
  eyebrow: "Curated, Not Crowded",
  headline: "Pieces You'll Actually Wear",
  sub: "A small, considered edit — restocked often, never overstuffed.",
  cta: "Shop the Edit",
  layout: "grid",
  heroStyle: "fullbleed",
  catalogLabel: "The Edit",
  sections: ["hero", "categories", "catalog", "about", "stats", "testimonials", "newsletter", "contact"],
  muted: HEENZY_BOUTIQUE.gray,
  border: HEENZY_BOUTIQUE.border,
  density: "compact",
};

export const TEMPLATE_NAME_HEENZY = "Heenzy Sneaker Co.";
export const TEMPLATE_NAME_HEENZY_BOUTIQUE = "Heenzy — Boutique Rose";

const HEENZY_TEMPLATE_NAMES = new Set([TEMPLATE_NAME_HEENZY, TEMPLATE_NAME_HEENZY_BOUTIQUE]);

export function isHeenzyTemplate(templateName: string | null | undefined): boolean {
  return !!templateName && HEENZY_TEMPLATE_NAMES.has(templateName);
}

function resolveHeenzyTheme(templateName: string | null | undefined): TemplateTheme {
  return templateName === TEMPLATE_NAME_HEENZY_BOUTIQUE ? HEENZY_BOUTIQUE_THEME : HEENZY_THEME;
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
  muted: NOVA.gray,
  border: NOVA.line,
  density: "relaxed",
};

// Second Nova Studio variant — same component, same layout structure,
// entirely different config: ivory/black instead of black/gold, tighter
// "compact" spacing, sharper corners. Proves the style-pack tokens above
// actually change the rendered page, not just the gallery thumbnail.
const NOVA_IVORY = {
  black: "#141110",
  charcoal: "#f6f3ee",
  cream: "#141110",
  gold: "#8a7a5c",
  gray: "#8a8580",
  line: "rgba(20,17,16,0.12)",
  font: "'Inter', sans-serif",
  headlineFont: "'Playfair Display', serif",
  radius: "0px",
} as const;

export const NOVA_IVORY_THEME: TemplateTheme = {
  bg: NOVA_IVORY.charcoal,
  ink: NOVA_IVORY.black,
  card: "#ffffff",
  accent: NOVA_IVORY.gold,
  font: NOVA_IVORY.font,
  headlineFont: NOVA_IVORY.headlineFont,
  radius: NOVA_IVORY.radius,
  eyebrow: "Est. — Considered, Not Crowded",
  headline: "Less, But Better",
  sub: "A pared-back studio built around restraint — every piece earns its place before it earns a shelf.",
  cta: "View the Collection",
  layout: "list",
  heroStyle: "split",
  catalogLabel: "The Collection",
  sections: ["hero", "about", "catalog", "testimonials", "stats", "newsletter", "contact"],
  muted: NOVA_IVORY.gray,
  border: NOVA_IVORY.line,
  density: "compact",
};

export const TEMPLATE_NAME_NOVA = "Nova Studio — Noir";
export const TEMPLATE_NAME_NOVA_IVORY = "Nova Studio — Ivory Minimal";
// Legacy name from before this template had variants. Kept so stores
// created under the old single-variant name still resolve correctly
// instead of silently losing their theme after this migration.
const TEMPLATE_NAME_NOVA_LEGACY = "Nova Studio";

const NOVA_TEMPLATE_NAMES = new Set([TEMPLATE_NAME_NOVA, TEMPLATE_NAME_NOVA_IVORY, TEMPLATE_NAME_NOVA_LEGACY]);

export function isNovaTemplate(templateName: string | null | undefined): boolean {
  return !!templateName && NOVA_TEMPLATE_NAMES.has(templateName);
}

function resolveNovaTheme(templateName: string | null | undefined): TemplateTheme {
  return templateName === TEMPLATE_NAME_NOVA_IVORY ? NOVA_IVORY_THEME : NOVA_THEME;
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
  muted: "#888888",
  border: "#eeeeee",
  density: "relaxed",
  surfaceDark: VIOLET.navy,
  accentSoft: VIOLET.lilac,
};

// Second Violet variant — same component, warm coral/sunset palette instead
// of purple/indigo, tighter "compact" spacing and a smaller corner radius.
// Config-only, same proof as Nova Ivory / Heenzy Boutique.
const VIOLET_SUNSET = {
  navy: "#2b1710",
  ink: "#241512",
  accent: "#f5734c",
  lilac: "#ffd9c2",
  bg: "#fffaf7",
  font: "'Inter', sans-serif",
  headlineFont: "'Inter', sans-serif",
  radius: "12px",
} as const;

export const VIOLET_SUNSET_THEME: TemplateTheme = {
  bg: VIOLET_SUNSET.bg,
  ink: VIOLET_SUNSET.ink,
  card: "#ffffff",
  accent: VIOLET_SUNSET.accent,
  font: VIOLET_SUNSET.font,
  headlineFont: VIOLET_SUNSET.headlineFont,
  radius: VIOLET_SUNSET.radius,
  eyebrow: "New Arrivals, Weekly",
  headline: "Warmth you can wear.",
  sub: "A hand-picked edit of everyday pieces, restocked often.",
  cta: "Shop the edit",
  layout: "grid",
  heroStyle: "split",
  catalogLabel: "The Edit",
  sections: ["hero", "categories", "catalog", "testimonials", "stats", "newsletter", "contact"],
  muted: "#8a7a72",
  border: "#f1e3db",
  density: "compact",
  surfaceDark: VIOLET_SUNSET.navy,
  accentSoft: VIOLET_SUNSET.lilac,
};

export const TEMPLATE_NAME_VIOLET = "Violet";
export const TEMPLATE_NAME_VIOLET_SUNSET = "Violet — Sunset";

const VIOLET_TEMPLATE_NAMES = new Set([TEMPLATE_NAME_VIOLET, TEMPLATE_NAME_VIOLET_SUNSET]);

export function isVioletTemplate(templateName: string | null | undefined): boolean {
  return !!templateName && VIOLET_TEMPLATE_NAMES.has(templateName);
}

function resolveVioletTheme(templateName: string | null | undefined): TemplateTheme {
  return templateName === TEMPLATE_NAME_VIOLET_SUNSET ? VIOLET_SUNSET_THEME : VIOLET_THEME;
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

/** ---------- Template 9: "Arcova" -- dark editorial architecture/agency layout, ported from arcova-react-nestjs.zip ---------- */
export const ARCOVA = {
  ink: "#141414",
  paper: "#ffffff",
  dark: "#0d0d0d",
  accent: "#c9a86a",
  border: "#e6e6e6",
  font: "'Helvetica Neue', Arial, sans-serif",
  headlineFont: "'Helvetica Neue', Arial, sans-serif",
  radius: "0px",
} as const;

export const ARCOVA_THEME: TemplateTheme = {
  bg: "#ffffff",
  ink: ARCOVA.ink,
  card: "#ffffff",
  accent: ARCOVA.accent,
  font: ARCOVA.font,
  headlineFont: ARCOVA.headlineFont,
  radius: ARCOVA.radius,
  eyebrow: "Built around you",
  headline: "We build timeless spaces.",
  sub: "From concept to completion, we craft extraordinary spaces that elevate living and stand the test of time.",
  cta: "Explore our work",
  layout: "grid",
  heroStyle: "split",
  catalogLabel: "Projects",
  sections: ["hero", "catalog", "features", "about", "testimonials", "contact"],
};

export const TEMPLATE_NAME_ARCOVA = "Arcova Architecture";

export function isArcovaTemplate(templateName: string | null | undefined): boolean {
  return templateName === TEMPLATE_NAME_ARCOVA;
}

/** ---------- Template 10: "Rivora Fresh" -- deep-green/lime grocery storefront, ported from rivora-fresh-react-nestjs.zip ---------- */
export const RIVORA = {
  deep: "#03291c",
  green: "#07502f",
  lime: "#9fe52e",
  muted: "#718078",
  ink: "#11281d",
  font: "Inter, Arial, sans-serif",
  headlineFont: "Inter, Arial, sans-serif",
  radius: "11px",
} as const;

export const RIVORA_THEME: TemplateTheme = {
  bg: "#f7f9f6",
  ink: RIVORA.ink,
  card: "#ffffff",
  accent: RIVORA.lime,
  font: RIVORA.font,
  headlineFont: RIVORA.headlineFont,
  radius: RIVORA.radius,
  eyebrow: "Fresh - Natural - Premium",
  headline: "Fresh choices, better life.",
  sub: "Premium quality fruits and vegetables, delivered fresh to your doorstep.",
  cta: "Shop now",
  layout: "grid",
  heroStyle: "split",
  catalogLabel: "Products",
  sections: ["hero", "categories", "about", "catalog", "newsletter", "contact"],
};

export const TEMPLATE_NAME_RIVORA = "Rivora Fresh";

export function isRivoraTemplate(templateName: string | null | undefined): boolean {
  return templateName === TEMPLATE_NAME_RIVORA;
}

/** ---------- Template 11: "JuiceLife" -- green/orange cold-pressed juice storefront, ported from juicelife-react-nestjs.zip ---------- */
export const JUICELIFE = {
  green: "#176b20",
  greenDark: "#0d5717",
  orange: "#f29a20",
  soft: "#f7faf1",
  ink: "#152015",
  muted: "#687068",
  font: "Arial, Helvetica, sans-serif",
  headlineFont: "Arial, Helvetica, sans-serif",
  radius: "12px",
} as const;

export const JUICELIFE_THEME: TemplateTheme = {
  bg: "#ffffff",
  ink: JUICELIFE.ink,
  card: "#ffffff",
  accent: JUICELIFE.green,
  font: JUICELIFE.font,
  headlineFont: JUICELIFE.headlineFont,
  radius: JUICELIFE.radius,
  eyebrow: "100% Natural & Fresh",
  headline: "Good juice. Good life.",
  sub: "Made with real fruits and vegetables. No sugar added. Just pure goodness in every sip.",
  cta: "Shop now",
  layout: "grid",
  heroStyle: "split",
  catalogLabel: "Menu",
  sections: ["hero", "catalog", "features", "about", "newsletter", "contact"],
};

export const TEMPLATE_NAME_JUICELIFE = "JuiceLife";

export function isJuiceLifeTemplate(templateName: string | null | undefined): boolean {
  return templateName === TEMPLATE_NAME_JUICELIFE;
}

/** ---------- Template 12: "Fabtex" -- dark industrial fabric/textile B2B storefront, ported from fabtex-react-nestjs-storefront.zip ---------- */
export const FABTEX = {
  dark: "#211f1f",
  black: "#090909",
  panel: "#292626",
  orange: "#f15a24",
  muted: "#aaaaaa",
  font: "Arial, Helvetica, sans-serif",
  headlineFont: "Arial, Helvetica, sans-serif",
  radius: "0px",
} as const;

export const FABTEX_THEME: TemplateTheme = {
  bg: FABTEX.dark,
  ink: "#ffffff",
  card: FABTEX.panel,
  accent: FABTEX.orange,
  font: FABTEX.font,
  headlineFont: FABTEX.headlineFont,
  radius: FABTEX.radius,
  eyebrow: "Performance fabric solutions",
  headline: "Everything. Right where you need it.",
  sub: "The performance fabric partner for hospitality, healthcare and commercial interiors.",
  cta: "Check out our fabrics now",
  layout: "grid",
  heroStyle: "fullbleed",
  catalogLabel: "Products",
  sections: ["hero", "catalog", "features", "about", "contact"],
};

export const TEMPLATE_NAME_FABTEX = "Fabtex";

export function isFabtexTemplate(templateName: string | null | undefined): boolean {
  return templateName === TEMPLATE_NAME_FABTEX;
}

/** The catalog has exactly two templates: Fresh & Co. (tier 1) and Heenzy Sneaker Co. (tier 2). */
export function generateNicheVariations(_nicheName: string): GeneratedTemplate[] {
  return [{ ...FRESH_THEME, variationName: TEMPLATE_NAME, tierRank: 1 }];
}

export function generateHeenzyVariations(): GeneratedTemplate[] {
  return [
    { ...HEENZY_THEME, variationName: TEMPLATE_NAME_HEENZY, tierRank: 2 },
    { ...HEENZY_BOUTIQUE_THEME, variationName: TEMPLATE_NAME_HEENZY_BOUTIQUE, tierRank: 2 },
  ];
}

/**
 * Returns every seedable Nova Studio variant. This is the pattern the
 * other 10 templates should move to as they migrate onto style-pack
 * tokens: one base layout component, N config objects, N rows in
 * StoreTemplate — instead of one generator returning exactly one theme.
 */
export function generateNovaVariations(): GeneratedTemplate[] {
  return [
    { ...NOVA_THEME, variationName: TEMPLATE_NAME_NOVA, tierRank: 3 },
    { ...NOVA_IVORY_THEME, variationName: TEMPLATE_NAME_NOVA_IVORY, tierRank: 3 },
  ];
}

export function generateVioletVariations(): GeneratedTemplate[] {
  return [
    { ...VIOLET_THEME, variationName: TEMPLATE_NAME_VIOLET, tierRank: 4 },
    { ...VIOLET_SUNSET_THEME, variationName: TEMPLATE_NAME_VIOLET_SUNSET, tierRank: 4 },
  ];
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

export function generateArcovaVariation(): GeneratedTemplate {
  return { ...ARCOVA_THEME, variationName: TEMPLATE_NAME_ARCOVA, tierRank: 4 };
}

export function generateRivoraVariation(): GeneratedTemplate {
  return { ...RIVORA_THEME, variationName: TEMPLATE_NAME_RIVORA, tierRank: 3 };
}

export function generateJuiceLifeVariation(): GeneratedTemplate {
  return { ...JUICELIFE_THEME, variationName: TEMPLATE_NAME_JUICELIFE, tierRank: 2 };
}

export function generateFabtexVariation(): GeneratedTemplate {
  return { ...FABTEX_THEME, variationName: TEMPLATE_NAME_FABTEX, tierRank: 3 };
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
  const base = isProfessionalServicesTemplate(templateName)
    ? getProfessionalServicesTheme(templateName)
    : isSignatureTemplate(templateName)
    ? getSignatureTheme(templateName)
    : isHeenzyTemplate(templateName)
    ? resolveHeenzyTheme(templateName)
    : isNovaTemplate(templateName)
    ? resolveNovaTheme(templateName)
    : isVioletTemplate(templateName)
    ? resolveVioletTheme(templateName)
    : isPremiumTemplate(templateName)
    ? PREMIUM_THEME
    : isHomeVistaTemplate(templateName)
    ? HOMEVISTA_THEME
    : isRrwTemplate(templateName)
    ? RRW_THEME
    : isMarketplaceTemplate(templateName)
    ? MARKETPLACE_THEME
    : isArcovaTemplate(templateName)
    ? ARCOVA_THEME
    : isRivoraTemplate(templateName)
    ? RIVORA_THEME
    : isJuiceLifeTemplate(templateName)
    ? JUICELIFE_THEME
    : isFabtexTemplate(templateName)
    ? FABTEX_THEME
    : FRESH_THEME;
  return {
    ...base,
    bg: overrides?.secondary || base.bg,
    accent: overrides?.primary || overrides?.accent || base.accent,
    font: fontFamily || base.font,
  };
}

// ---------------------------------------------------------------------------
// BizNest Signature Collection — new, industry-first storefront designs.
// These are intentionally separate from the legacy templates above. They use
// one hardened rendering engine with genuinely different layout modes, not
// merely palette swaps.
// ---------------------------------------------------------------------------

const SIGNATURE_BASE = {
  font: "'Inter', sans-serif",
  headlineFont: "'Space Grotesk', sans-serif",
  radius: "18px",
  sections: ["hero", "categories", "catalog", "features", "testimonials", "contact"] as Section[],
};

function signatureTheme(data: Omit<TemplateTheme, "font" | "headlineFont" | "radius" | "sections"> & { signatureMode: string }): TemplateTheme & { signatureMode: string } {
  return { ...SIGNATURE_BASE, ...data };
}

export const SCREENSHOT_SIGNATURE_TEMPLATES = [
  signatureTheme({ signatureMode: "great-treasure", bg: "#07100D", ink: "#F7F3EA", card: "#111A16", accent: "#E4A93A", accentSoft: "#8B6A2E", muted: "#B8B1A4", border: "#3B4039", eyebrow: "Luxury, Comfort & Great Taste", headline: "Great hospitality, all in one place.", sub: "A hospitality experience centered on rooms, food, comfort and direct booking.", cta: "Book a Room", layout: "grid", heroStyle: "fullbleed", catalogLabel: "Our Rooms & Suites", density: "relaxed", surfaceDark: "#050907" }),
  signatureTheme({ signatureMode: "grand-vere", bg: "#FFFFFF", ink: "#17352A", card: "#FBFAF6", accent: "#0E5B45", accentSoft: "#B9A06A", muted: "#74736D", border: "#E7E3D9", eyebrow: "LUXURY REDEFINED", headline: "Experience Timeless Elegance", sub: "World-class comfort, exceptional service and unforgettable moments.", cta: "Discover More", layout: "grid", heroStyle: "fullbleed", catalogLabel: "Rooms & Suites", density: "relaxed", surfaceDark: "#063522" }),
  signatureTheme({ signatureMode: "belora", bg: "#FCFAFD", ink: "#2A2430", card: "#FFFFFF", accent: "#7B4BC0", accentSoft: "#D9C5F2", muted: "#746D7A", border: "#E8E0EF", eyebrow: "NATURAL BEAUTY, RADIANT YOU", headline: "Pure Ingredients, Powerful Results", sub: "Clean, effective beauty designed for every skin type.", cta: "Shop Now", layout: "grid", heroStyle: "split", catalogLabel: "Best Sellers", density: "relaxed", surfaceDark: "#402365" }),
  signatureTheme({ signatureMode: "tastehouse", bg: "#FFFCF7", ink: "#161616", card: "#FFFFFF", accent: "#F26B21", accentSoft: "#FFE1BF", muted: "#747474", border: "#EEE7DE", eyebrow: "GOOD FOOD, GOOD MOOD", headline: "Delicious Food Delivered Fast.", sub: "Discover dishes, cuisines and offers from your kitchen's favorite menu.", cta: "Order Now", layout: "grid", heroStyle: "split", catalogLabel: "Popular Dishes", density: "compact", surfaceDark: "#171717" }),
  signatureTheme({ signatureMode: "flavora-kitchen", bg: "#FFFFFF", ink: "#111111", card: "#FFFFFF", accent: "#D9281C", accentSoft: "#FFB39E", muted: "#6C6C6C", border: "#E7E7E7", eyebrow: "FRESH • FLAVORFUL • FAST", headline: "Experience Taste Like Never Before", sub: "Bold dishes, fresh ingredients and a simple online ordering experience.", cta: "Order Online", layout: "grid", heroStyle: "fullbleed", catalogLabel: "Popular Dishes", density: "relaxed", surfaceDark: "#141414" }),
  signatureTheme({ signatureMode: "flavora-restaurant", bg: "#F7F0E7", ink: "#201710", card: "#FFFDF9", accent: "#F39A0B", accentSoft: "#6B3212", muted: "#756B61", border: "#E7D9C8", eyebrow: "GOOD FOOD, GOOD MOOD", headline: "Delicious Food Made with Love", sub: "The perfect blend of taste, quality and happiness in every bite.", cta: "Explore Menu", layout: "list", heroStyle: "fullbleed", catalogLabel: "Popular Dishes", density: "relaxed", surfaceDark: "#100A06" }),
] as const;

export const SIGNATURE_TEMPLATES = [
  signatureTheme({ signatureMode: "electra", bg: "#F5F7FA", ink: "#101828", card: "#FFFFFF", accent: "#2563EB", accentSoft: "#93C5FD", muted: "#667085", border: "#E4E7EC", eyebrow: "Technology, refined.", headline: "Smarter gear. Better living.", sub: "A premium electronics storefront built around discovery, comparison and confident checkout.", cta: "Shop the latest", layout: "grid", heroStyle: "split", catalogLabel: "Featured tech", density: "relaxed", surfaceDark: "#0B1220" }),
  signatureTheme({ signatureMode: "atelier", bg: "#F7F3EE", ink: "#211C1A", card: "#FFFDFC", accent: "#B56B45", accentSoft: "#E8B39A", muted: "#756C67", border: "#E8DED7", eyebrow: "The new season", headline: "Wear less. Choose better.", sub: "An editorial fashion storefront with generous imagery, curated collections and a strong visual rhythm.", cta: "Explore collection", layout: "grid", heroStyle: "fullbleed", catalogLabel: "The edit", density: "relaxed", surfaceDark: "#241E1B" }),
  signatureTheme({ signatureMode: "kinetic", bg: "#0B0B0D", ink: "#F5F5F5", card: "#141416", accent: "#D7FF3F", accentSoft: "#6F7F19", muted: "#A4A4AA", border: "#2A2A2E", eyebrow: "New drop / limited", headline: "Move different.", sub: "A high-energy sneaker storefront designed for drops, scarcity and fast product discovery.", cta: "Shop the drop", layout: "grid", heroStyle: "fullbleed", catalogLabel: "Latest drop", density: "compact", surfaceDark: "#050506" }),
  signatureTheme({ signatureMode: "bloom", bg: "#FCF7F5", ink: "#302324", card: "#FFFFFF", accent: "#B86C7C", accentSoft: "#E8B6C0", muted: "#806E72", border: "#EEDFE3", eyebrow: "Rituals for every day", headline: "Beauty, made personal.", sub: "A soft, premium beauty storefront for skincare, makeup, haircare and self-care collections.", cta: "Shop beauty", layout: "grid", heroStyle: "split", catalogLabel: "The ritual edit", density: "relaxed", surfaceDark: "#302124" }),
  signatureTheme({ signatureMode: "haven", bg: "#F3F0E9", ink: "#25231F", card: "#FBFAF6", accent: "#7A6B50", accentSoft: "#C7B99A", muted: "#777168", border: "#DED8CC", eyebrow: "Objects for better living", headline: "Make room for beautiful.", sub: "A refined furniture and interiors storefront with room-led collections and tactile product presentation.", cta: "Explore the home", layout: "grid", heroStyle: "fullbleed", catalogLabel: "Room edit", density: "relaxed", surfaceDark: "#2B2925" }),
  signatureTheme({ signatureMode: "harvest", bg: "#F6F8F1", ink: "#17351E", card: "#FFFFFF", accent: "#4E8B43", accentSoft: "#A8CF82", muted: "#667563", border: "#DDE7D7", eyebrow: "Fresh to your door", headline: "Good food, less friction.", sub: "A fast grocery storefront built around categories, weekly picks, deals and repeat shopping.", cta: "Shop groceries", layout: "grid", heroStyle: "split", catalogLabel: "Fresh picks", density: "compact", surfaceDark: "#17351E" }),
  signatureTheme({ signatureMode: "maison", bg: "#F5F0E8", ink: "#211B18", card: "#FFFDF8", accent: "#B78A52", accentSoft: "#DCC29D", muted: "#766D66", border: "#E4D8C8", eyebrow: "Stay somewhere beautiful", headline: "Your room is part of the journey.", sub: "A hospitality storefront designed for rooms, amenities, availability and direct booking confidence.", cta: "Find your room", layout: "grid", heroStyle: "fullbleed", catalogLabel: "Rooms & stays", density: "relaxed", surfaceDark: "#201A16" }),
  signatureTheme({ signatureMode: "hotel", bg: "#F4F0E9", ink: "#211B18", card: "#FBF8F2", accent: "#A97A45", accentSoft: "#D9BB96", muted: "#756D65", border: "#E2D8CA", eyebrow: "Hospitality, thoughtfully considered", headline: "A stay with a sense of place.", sub: "A company-first hospitality website built around story, rooms, experience, visual narrative and direct guest enquiries.", cta: "Discover the stay", layout: "list", heroStyle: "fullbleed", catalogLabel: "Rooms & suites", density: "relaxed", surfaceDark: "#171411" }),
  signatureTheme({ signatureMode: "ember", bg: "#171313", ink: "#FFF7EF", card: "#211B1B", accent: "#F08A3C", accentSoft: "#8C4722", muted: "#B7A8A1", border: "#352A29", eyebrow: "Good food. Good nights.", headline: "Come hungry. Leave happy.", sub: "A restaurant storefront built around signature dishes, menu discovery and reservations or ordering.", cta: "View the menu", layout: "list", heroStyle: "fullbleed", catalogLabel: "Tonight's menu", density: "relaxed", surfaceDark: "#0F0C0C" }),
  signatureTheme({ signatureMode: "muse", bg: "#F8F5F2", ink: "#292323", card: "#FFFFFF", accent: "#8C5C78", accentSoft: "#D3B0C4", muted: "#786E72", border: "#E7DFDB", eyebrow: "Your time, beautifully spent", headline: "Appointments that feel like a reset.", sub: "A salon experience built around services, specialists, packages and effortless booking.", cta: "Book an appointment", layout: "grid", heroStyle: "split", catalogLabel: "Services & packages", density: "relaxed", surfaceDark: "#292023" }),
  signatureTheme({ signatureMode: "frame", bg: "#F3F1ED", ink: "#1B1B1B", card: "#FBFAF7", accent: "#1B1B1B", accentSoft: "#8A8A8A", muted: "#777777", border: "#DCDAD5", eyebrow: "Stories worth remembering", headline: "Let the work speak.", sub: "A cinematic photography storefront with portfolio-first storytelling and clear packages.", cta: "View the portfolio", layout: "grid", heroStyle: "fullbleed", catalogLabel: "Selected work", density: "relaxed", surfaceDark: "#111111" }),
  signatureTheme({ signatureMode: "north", bg: "#EEF2F6", ink: "#0D1B2A", card: "#FFFFFF", accent: "#176B87", accentSoft: "#76B7C7", muted: "#617080", border: "#D9E1E8", eyebrow: "Strategy with substance", headline: "Clarity that compounds.", sub: "A sharp agency storefront focused on capabilities, proof, process and consultation.", cta: "Start a project", layout: "list", heroStyle: "split", catalogLabel: "Capabilities", density: "relaxed", surfaceDark: "#0D1B2A" }),
  signatureTheme({ signatureMode: "pure", bg: "#F2F7F5", ink: "#17352D", card: "#FFFFFF", accent: "#2B8A70", accentSoft: "#8BC9B6", muted: "#647871", border: "#D9E8E2", eyebrow: "A cleaner space starts here", headline: "Clean you can count on.", sub: "A trustworthy cleaning storefront built around services, packages, coverage areas and booking.", cta: "Book a clean", layout: "grid", heroStyle: "split", catalogLabel: "Cleaning services", density: "relaxed", surfaceDark: "#17352D" }),
  signatureTheme({ signatureMode: "forge", bg: "#F1F0EC", ink: "#202321", card: "#FFFFFF", accent: "#C86B2A", accentSoft: "#D9A276", muted: "#6D706E", border: "#DCDDD8", eyebrow: "Built for the long run", headline: "Serious work. Properly built.", sub: "A construction storefront designed around projects, services, proof, process and quote requests.", cta: "Request a quote", layout: "grid", heroStyle: "fullbleed", catalogLabel: "Projects & services", density: "relaxed", surfaceDark: "#202321" }),
] as const;

for (const t of SCREENSHOT_SIGNATURE_TEMPLATES as unknown as any[]) {
  if (!t.variationName) {
    Object.defineProperty(t, "variationName", { enumerable: true, configurable: true, value: ({
      "great-treasure": "Great Treasure — Hotel & Suites", "grand-vere": "Grand Vere — Hotel & Resort", belora: "Belora — Skincare Boutique",
      tastehouse: "TasteHouse — Food Delivery", "flavora-kitchen": "Flavora Kitchen — Restaurant", "flavora-restaurant": "Flavora — Restaurant",
    } as Record<string,string>)[t.signatureMode] });
  }
}

export type SignatureTemplate = TemplateTheme & { signatureMode: string; variationName: string };
export type SignatureTemplateName = SignatureTemplate["variationName"];

// Assign stable names after creation so the config stored in Prisma is self-describing.
for (const t of SIGNATURE_TEMPLATES as unknown as any[]) {
  if (!t.variationName) {
    Object.defineProperty(t, "variationName", { enumerable: true, configurable: true, value: ({
      electra: "Electra — Smart Commerce", atelier: "Atelier — Modern Fashion", kinetic: "Kinetic — Sneaker Drop",
      bloom: "Bloom — Beauty Boutique", haven: "Haven — Home & Furniture", harvest: "Harvest — Grocery Market",
      maison: "Maison — Hotel & Stay", hotel: "Grand — Hotel & Hospitality", ember: "Ember — Restaurant", muse: "Muse — Salon & Beauty",
      frame: "Frame — Photography Studio", north: "North — Creative Agency", pure: "Pure — Cleaning Services", forge: "Forge — Construction",
    } as Record<string,string>)[t.signatureMode] });
  }
}

export const SIGNATURE_TEMPLATE_CATALOG = [...SIGNATURE_TEMPLATES, ...SCREENSHOT_SIGNATURE_TEMPLATES] as unknown as readonly SignatureTemplate[];



/** ---------- Professional Services Collection ----------
 * Each sub-niche has its own visual language and information architecture.
 * These are not palette swaps: the storefront renderer changes structure,
 * density, typography, navigation emphasis and CTA model per mode.
 */
const PROFESSIONAL_SERVICE_THEMES = [
  { id:"graphic-design", name:"Obsidian Atelier — Graphic Design & Print", category:"Professional Services · Creative & Print", bg:"#F5F0E8", ink:"#171717", card:"#FFFFFF", accent:"#D7A54A", accentSoft:"#6D4D19", muted:"#77716A", border:"#DED5C8", headline:"Ideas, made tangible.", sub:"Premium creative, branding and print production.", professionalMode:"graphic-design" },
  { id:"branding-agency", name:"Noir Identity — Brand Strategy", category:"Professional Services · Branding", bg:"#F7F6F2", ink:"#111111", card:"#FFFFFF", accent:"#A51D2D", accentSoft:"#4A0D14", muted:"#6F6F6B", border:"#DFDED8", headline:"Make your brand unmistakable.", sub:"Strategy, identity and art direction for brands with ambition.", professionalMode:"branding-agency" },
  { id:"marketing-agency", name:"Cobalt Bureau — Marketing & Digital", category:"Professional Services · Marketing", bg:"#EEF4FF", ink:"#10234B", card:"#FFFFFF", accent:"#173BFF", accentSoft:"#8AA0FF", muted:"#667085", border:"#D6E0FF", headline:"Marketing with a point of view.", sub:"Campaigns and growth systems built for measurable momentum.", professionalMode:"marketing-agency" },
  { id:"photography-studio", name:"Nocturne Studio — Photography", category:"Professional Services · Photography", bg:"#0B0B0B", ink:"#FFFFFF", card:"#141414", accent:"#C9A36A", accentSoft:"#6B5332", muted:"#999999", border:"#FFFFFF20", headline:"Light, captured with intention.", sub:"Cinematic photography for people, products and brands.", professionalMode:"photography-studio" },
  { id:"consulting", name:"Meridian Advisory — Consulting", category:"Professional Services · Consulting", bg:"#F3F1EB", ink:"#15202B", card:"#FFFFFF", accent:"#A88345", accentSoft:"#5D4A2B", muted:"#6C7378", border:"#D9D5CA", headline:"Clarity for consequential decisions.", sub:"Independent strategy and executive advisory.", professionalMode:"consulting" },
  { id:"accounting", name:"Ledger House — Accounting & Finance", category:"Professional Services · Finance", bg:"#F4F7F2", ink:"#163B2C", card:"#FFFFFF", accent:"#26805A", accentSoft:"#8FCEA9", muted:"#667A70", border:"#D7E5DC", headline:"Numbers you can trust.", sub:"Modern accounting, tax and financial advisory.", professionalMode:"accounting" },
  { id:"legal", name:"Crown & Chambers — Legal", category:"Professional Services · Legal", bg:"#F4EFE7", ink:"#241719", card:"#FFFFFF", accent:"#B38A4B", accentSoft:"#684C2B", muted:"#756D66", border:"#DED4C7", headline:"Counsel when it matters.", sub:"Discreet commercial counsel and representation.", professionalMode:"legal" },
  { id:"hr-recruitment", name:"Bluebird People — HR & Recruitment", category:"Professional Services · People", bg:"#EEF5FF", ink:"#10233F", card:"#FFFFFF", accent:"#0D5CFF", accentSoft:"#87A8FF", muted:"#667085", border:"#D6E2F7", headline:"The right people change everything.", sub:"Executive search, recruitment and people strategy.", professionalMode:"hr-recruitment" },
  { id:"web-development", name:"Signal Labs — Web & Software", category:"Professional Services · Digital Products", bg:"#07090D", ink:"#F2F6FF", card:"#10141C", accent:"#7CFF67", accentSoft:"#3C7F34", muted:"#8C95A4", border:"#FFFFFF14", headline:"Digital products that move businesses forward.", sub:"Strategy, design and engineering for high-performance digital products.", professionalMode:"web-development" },
  { id:"it-services", name:"Northstar Systems — IT & Technology", category:"Professional Services · IT", bg:"#07111F", ink:"#F3F8FF", card:"#0D1D33", accent:"#4CC9F0", accentSoft:"#276A82", muted:"#9AABBD", border:"#FFFFFF16", headline:"Technology, without the noise.", sub:"Infrastructure, cybersecurity and managed support.", professionalMode:"it-services" },
  { id:"architecture", name:"Forma House — Architecture & Interiors", category:"Professional Services · Architecture", bg:"#E9E4DA", ink:"#252522", card:"#F5F2EB", accent:"#9A7952", accentSoft:"#5B4834", muted:"#716F69", border:"#D1CABD", headline:"Spaces with a sense of permanence.", sub:"Architecture and interiors shaped by proportion, material and light.", professionalMode:"architecture" },
  { id:"engineering", name:"Axis Engineering — Engineering", category:"Professional Services · Engineering", bg:"#EDF0F1", ink:"#182329", card:"#FFFFFF", accent:"#D28A32", accentSoft:"#79501F", muted:"#69767C", border:"#D3DADC", headline:"Precision behind the build.", sub:"Engineering confidence from concept through delivery.", professionalMode:"engineering" },
  { id:"construction-company", name:"Foundry Build — Construction", category:"Professional Services · Construction", bg:"#DEDDD8", ink:"#1D1E1B", card:"#FFFFFF", accent:"#F28B30", accentSoft:"#8A4C1D", muted:"#6D6D68", border:"#C9C9C2", headline:"Built properly. Built to last.", sub:"Construction, renovation and project delivery.", professionalMode:"construction-company" },
] as const;

export type ProfessionalServiceTemplate = TemplateTheme & { professionalMode: string; variationName: string; category: string };
export const PROFESSIONAL_SERVICE_TEMPLATE_CATALOG = PROFESSIONAL_SERVICE_THEMES.map((t) => ({
  ...t,
  variationName: t.name,
  tierRank: 3 as const,
  // Raw entries above only define the fields that actually vary per
  // sub-niche (palette, headline/sub copy, mode). These fill in the rest
  // of TemplateTheme with sensible, consistent defaults for the whole
  // professional-services collection.
  font: "'Inter', system-ui, sans-serif",
  headlineFont: "'Fraunces', Georgia, serif",
  radius: "4px",
  eyebrow: "PROFESSIONAL SERVICES",
  cta: "Get in touch",
  layout: "grid" as const,
  heroStyle: "split" as const,
  catalogLabel: "Services",
  sections: ["hero", "about", "features", "testimonials", "contact"] as const,
})) as readonly (ProfessionalServiceTemplate & { tierRank: 3 })[];
export const PROFESSIONAL_SERVICE_TEMPLATE_NAMES = new Set(PROFESSIONAL_SERVICE_TEMPLATE_CATALOG.map((t) => t.variationName));
export function isProfessionalServicesTemplate(name: string | null | undefined): boolean { return !!name && PROFESSIONAL_SERVICE_TEMPLATE_NAMES.has(name); }
export function getProfessionalServicesTheme(name: string | null | undefined): ProfessionalServiceTemplate {
  return (PROFESSIONAL_SERVICE_TEMPLATE_CATALOG.find((t) => t.variationName === name) || PROFESSIONAL_SERVICE_TEMPLATE_CATALOG[0]) as ProfessionalServiceTemplate;
}

export function isSignatureTemplate(name: string | null | undefined): boolean {
  return !!name && SIGNATURE_TEMPLATE_CATALOG.some((t) => t.variationName === name);
}

export function getSignatureTheme(name: string | null | undefined): TemplateTheme & { signatureMode: string } {
  const found = SIGNATURE_TEMPLATE_CATALOG.find((t) => t.variationName === name);
  return found || SIGNATURE_TEMPLATE_CATALOG[0];
}
