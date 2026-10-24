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
import { canonicalizeBusinessType } from "./business-identity";


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
/** Per-template headings for the builder's sections, so a restaurant and a cleaner do not share "Let's work together". */
export type SectionCopy = Partial<Record<"about" | "features" | "categories" | "testimonials" | "newsletter" | "contact" | "gallery" | "map", { eyebrow: string; heading: string }>>;

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
  /** Optional niche-specific section headings (falls back to generic headings in template-builder-config.ts). */
  sectionCopy?: SectionCopy;
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
  /** Structural identity: header / footer / product-card layout. Every template gets its own combination. */
  chrome?: TemplateChrome;
  /** This template's own hero composition (components/storefront/hero-variants.tsx). Unique per header. */
  heroVariant?: HeroVariant;
};

export type TemplateChrome = {
  header: "classic" | "centered" | "overlay" | "bar" | "stripe";
  footer: "columns" | "centered" | "cta" | "minimal";
  card: "bordered" | "overlay" | "minimal" | "tall";
};

export type GeneratedTemplate = TemplateTheme & {
  variationName: string;
  tierRank: 1 | 2 | 3 | 4;
};

// Backward-compatible templates retained for existing stores.
import { HOTEL_TEMPLATE_NAME } from "./hotel-content";
import type { HeroVariant } from "./builder-config";
import { THELUSO_THEME } from "./hotel-theme";
import { TASTEHOUSE_TEMPLATE_NAME } from "./tastehouse-content";
import { EXAMPLE_TEMPLATE_NAME } from "./example-content";

// Re-exported: template-registry.ts, template-compatibility.ts, prisma/seed.ts
// and several storefront pages import these template names from this module
// rather than from each template's own content file.
export { HOTEL_TEMPLATE_NAME, TASTEHOUSE_TEMPLATE_NAME, EXAMPLE_TEMPLATE_NAME };

export const HOTEL_THEME = THELUSO_THEME as unknown as GeneratedTemplate;
export const GRANDEUR_TEMPLATE_NAME = "Grandeur — Fine Dining Restaurant";
export const GRANDEUR_THEME: GeneratedTemplate = {
  variationName: GRANDEUR_TEMPLATE_NAME, tierRank: 3, bg: "#F7F1E8", ink: "#1D1712", card: "#FFFDF9", accent: "#C8944A", accentSoft: "#D9AD68",
  muted: "#746B63", border: "#E7DED3", font: "'Inter', sans-serif", headlineFont: "'Playfair Display', Georgia, serif", radius: "18px",
  eyebrow: "FINE DINING • GREAT COMPANY", headline: "Exceptional Taste, Memorable Moments", sub: "A premium restaurant experience built around dining, reservations, ordering and a complete customer journey.",
  cta: "View Our Menu", layout: "list", heroStyle: "fullbleed", catalogLabel: "Popular Dishes", density: "relaxed", surfaceDark: "#0D0A07",
  sections: ["hero","categories","catalog","features","about","gallery","testimonials","contact","newsletter"],
};
export const TASTEHOUSE_THEME: GeneratedTemplate = {
  variationName: TASTEHOUSE_TEMPLATE_NAME, tierRank: 2, bg: "#FFFBF5", ink: "#241608", card: "#FFFFFF", accent: "#E85D2C", accentSoft: "#FDE3D3",
  muted: "#7A6A5D", border: "#F1E4D6", font: "'Inter', sans-serif", headlineFont: "'Poppins', sans-serif", radius: "16px",
  eyebrow: "FAST • FRESH • DELIVERED", headline: "Delicious Food, Made For You.", sub: "Explore this business's menu, current offers and place your order for delivery or pickup.",
  cta: "Order Now", layout: "grid", heroStyle: "split", catalogLabel: "Popular Menu Items", density: "relaxed", surfaceDark: "#1A0F06",
  sections: ["hero","categories","deal","catalog","features","testimonials","contact","newsletter"],
};
export const EXAMPLE_THEME: GeneratedTemplate = { variationName: EXAMPLE_TEMPLATE_NAME, tierRank: 2, bg: "#ffffff", ink: "#11131a", card: "#ffffff", accent: "#4b19ff", accentSoft: "#eeeaff", muted: "#697084", border: "#e8e7ef", font: "Inter, sans-serif", headlineFont: "Inter, sans-serif", radius: "12px", eyebrow: "NEW LAUNCH", headline: "Future Technology Today.", sub: "Explore the latest smart devices and innovations.", cta: "Shop Now", layout: "grid", heroStyle: "fullbleed", catalogLabel: "Featured Products", density: "relaxed", surfaceDark: "#05050a", sections: ["hero","categories","deal","catalog","features","newsletter"] };

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
  eyebrow: "Fresh Juices & Smoothies",
  headline: "Good juice. Good life.",
  sub: "Fresh fruit and vegetable juices, blended to order. Browse the menu and order online.",
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

/** Fresh & Co. (tier 1). The other legacy templates have their own generate* functions below. */
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

export const RESTORED_LEGACY_TEMPLATE_CATALOG: readonly GeneratedTemplate[] = [
  { ...FRESH_THEME, variationName: TEMPLATE_NAME, tierRank: 1 },
  ...generateHeenzyVariations(),
  ...generateNovaVariations(),
  ...generateVioletVariations(),
  generatePremiumVariation(), generateHomeVistaVariation(), generateRrwVariation(), generateMarketplaceVariation(), generateArcovaVariation(),
  generateRivoraVariation(), generateJuiceLifeVariation(), generateFabtexVariation(),
];

export function getTemplateTheme(category: string | undefined, _storeName: string): TemplateTheme {
  const wanted = canonicalizeBusinessType(category);
  if (wanted !== "Other") {
    const legacy = RESTORED_LEGACY_TEMPLATE_CATALOG.find((t) => LEGACY_CATEGORY_BY_NAME[t.variationName] === wanted);
    if (legacy) return resolveStoreTheme(category, _storeName, null, null, legacy.variationName);
    const signature = SIGNATURE_TEMPLATE_CATALOG.find((t) => SIGNATURE_CATEGORY_BY_MODE[t.signatureMode] === wanted);
    if (signature) return resolveStoreTheme(category, _storeName, null, null, signature.variationName);
  }
  return resolveStoreTheme(category, _storeName, null, null, undefined);
}

/** Merge a store's saved overrides (from Settings) on top of its selected template's default. */
// ---------------------------------------------------------------------------
// Template identity presets. Rule: no two builder-rendered templates may share the same
// header + footer + card combination (enforced by lib/__tests__/template-uniqueness.test.ts).
// ---------------------------------------------------------------------------
const C = (header: TemplateChrome["header"], footer: TemplateChrome["footer"], card: TemplateChrome["card"]): TemplateChrome => ({ header, footer, card });
export const SIGNATURE_CHROME: Record<string, TemplateChrome> = {
  electra: C("bar", "columns", "bordered"),
  atelier: C("centered", "centered", "tall"),
  kinetic: C("stripe", "minimal", "overlay"),
  haven: C("classic", "cta", "minimal"),
  harvest: C("bar", "cta", "tall"),
  ember: C("centered", "columns", "overlay"),
  muse: C("centered", "cta", "bordered"),
  frame: C("overlay", "centered", "minimal"),
  north: C("classic", "columns", "bordered"),
  pure: C("bar", "centered", "minimal"),
  forge: C("classic", "minimal", "tall"),
};
/**
 * Each builder-rendered signature template owns one hero composition. The pair (header, heroVariant)
 * must be unique across ALL builder templates -- enforced by lib/__tests__/template-uniqueness.test.ts.
 */
export const HERO_VARIANT_BY_MODE: Readonly<Record<string, HeroVariant>> = {
  electra: "tiles", atelier: "editorial", kinetic: "poster", haven: "frame", harvest: "splitcard",
  ember: "menu", muse: "arch", frame: "frame", north: "ledger", pure: "quiet", forge: "poster",
  // Dedicated-renderer templates (bloom, maison, hotel) never reach the Builder; listed so the map is complete.
  bloom: "arch", maison: "splitcard", hotel: "splitcard",
};
/** Templates that used to reuse another template's renderer. They now render through the Builder with their own identity. */
export const NAMED_TEMPLATE_IDENTITY: Record<string, { chrome: TemplateChrome; heroStyle?: HeroStyle; heroVariant?: HeroVariant }> = {
  "Emarket Furniture & Home": { chrome: C("classic", "columns", "tall"), heroStyle: "split", heroVariant: "splitcard" },
  "ShopNova Marketplace": { chrome: C("bar", "minimal", "bordered"), heroStyle: "centered", heroVariant: "banner" },
  "Electra Blue Electronics": { chrome: C("centered", "minimal", "bordered"), heroStyle: "fullbleed", heroVariant: "quiet" },
  "TechNova Mobile Store": { chrome: C("overlay", "cta", "bordered"), heroStyle: "split", heroVariant: "splitcard" },
  "TechVerse Gadgets": { chrome: C("bar", "centered", "overlay"), heroStyle: "centered", heroVariant: "poster" },
  "ShopEase General Store": { chrome: C("centered", "columns", "minimal"), heroStyle: "fullbleed", heroVariant: "tiles" },
  "Violet — Sunset": { chrome: C("centered", "minimal", "tall"), heroStyle: "centered", heroVariant: "banner" },
  "Nova Studio — Ivory Minimal": { chrome: C("bar", "columns", "minimal"), heroStyle: "split", heroVariant: "ledger" },
  "Heenzy — Boutique Rose": { chrome: C("overlay", "columns", "tall"), heroStyle: "fullbleed", heroVariant: "lookbook" },
};

function lookupReferenceTheme(name: string | null | undefined): TemplateTheme | null {
  if (!name || !NAMED_TEMPLATE_IDENTITY[name]) return null;
  try {
    // Lazy require: reference-template-catalog imports this module.
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const { REFERENCE_TEMPLATE_CATALOG } = require("@/lib/reference-template-catalog") as { REFERENCE_TEMPLATE_CATALOG: readonly (TemplateTheme & { variationName: string })[] };
    return REFERENCE_TEMPLATE_CATALOG.find((t) => t.variationName === name) ?? null;
  } catch { return null; }
}

export function resolveStoreTheme(
  _templateCategory: string | undefined,
  _storeName: string,
  overrides: { primary?: string; secondary?: string; accent?: string } | null | undefined,
  fontFamily: string | null | undefined,
  templateName?: string | null
): TemplateTheme {
  const base = lookupReferenceTheme(templateName)
    ? lookupReferenceTheme(templateName)!
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
    : templateName === HOTEL_TEMPLATE_NAME
    ? HOTEL_THEME
    : templateName === TASTEHOUSE_TEMPLATE_NAME
    ? TASTEHOUSE_THEME
    : templateName === EXAMPLE_TEMPLATE_NAME
    ? EXAMPLE_THEME
    : templateName === GRANDEUR_TEMPLATE_NAME
    ? GRANDEUR_THEME
    : isSignatureTemplate(templateName)
    ? getSignatureTheme(templateName)
    : FRESH_THEME;
  const identity = templateName ? NAMED_TEMPLATE_IDENTITY[templateName] : undefined;
  return {
    ...base,
    ...(identity ? { chrome: identity.chrome, ...(identity.heroStyle ? { heroStyle: identity.heroStyle } : {}), ...(identity.heroVariant ? { heroVariant: identity.heroVariant } : {}) } : {}),
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

// Each signature template gets its own page structure (which sections, in what order).
// Previously every one of them shared SIGNATURE_BASE.sections, so apart from colours and
// copy they all rendered the identical layout -- picking a different template looked like
// nothing had changed. Only section types the Builder renders without extra data are used.
const SIGNATURE_SECTIONS: Record<string, Section[]> = {
  electra: ["hero", "categories", "catalog", "features", "testimonials", "newsletter", "contact"],
  atelier: ["hero", "catalog", "about", "categories", "testimonials", "newsletter"],
  kinetic: ["hero", "catalog", "categories", "newsletter", "features", "contact"],
  bloom: ["hero", "about", "catalog", "features", "testimonials", "newsletter"],
  haven: ["hero", "categories", "about", "catalog", "features", "contact"],
  harvest: ["hero", "categories", "catalog", "features", "newsletter", "contact"],
  maison: ["hero", "about", "catalog", "features", "testimonials", "contact"],
  hotel: ["hero", "about", "catalog", "features", "testimonials", "newsletter", "contact"],
  ember: ["hero", "catalog", "about", "testimonials", "contact"],
  muse: ["hero", "catalog", "about", "features", "testimonials", "contact"],
  frame: ["hero", "about", "catalog", "testimonials", "contact"],
  north: ["hero", "features", "about", "catalog", "testimonials", "contact"],
  pure: ["hero", "features", "catalog", "about", "testimonials", "contact"],
  forge: ["hero", "about", "features", "catalog", "testimonials", "contact"],
};

const c = (eyebrow: string, heading: string) => ({ eyebrow, heading });
export const SIGNATURE_SECTION_COPY: Readonly<Record<string, SectionCopy>> = {
  electra: { categories: c("Browse", "Shop by category"), features: c("Good to know", "Shopping made simple"), testimonials: c("Reviews", "What buyers say"), newsletter: c("New arrivals", "Hear about new stock first"), contact: c("Get in touch", "Questions about a product?") },
  atelier: { about: c("The label", "Our story"), categories: c("The edit", "Shop the collections"), testimonials: c("In their words", "Worn and loved"), newsletter: c("The list", "First look at new pieces") },
  kinetic: { categories: c("Drops", "Shop by style"), newsletter: c("Early access", "Get notified on the next drop"), features: c("The details", "Made to be seen"), contact: c("Support", "Need help with sizing?") },
  bloom: { about: c("The boutique", "Beauty, simply chosen"), features: c("The routine", "Made for your everyday"), testimonials: c("Kind words", "What our clients say"), newsletter: c("Beauty notes", "Tips and new arrivals") },
  haven: { categories: c("Rooms", "Shop by room"), about: c("Our approach", "Pieces for how you live"), features: c("Good to know", "Delivery and care"), contact: c("Visit or call", "Talk to us about your space") },
  harvest: { categories: c("Aisles", "Shop by aisle"), features: c("How it works", "Order, pack, deliver"), newsletter: c("Weekly picks", "Hear about what is in season"), contact: c("Find us", "Order help and pickup") },
  maison: { about: c("The house", "A place to stay"), features: c("Your stay", "What is included"), testimonials: c("Guest notes", "What guests say"), contact: c("Reservations", "Plan your stay") },
  hotel: { about: c("Our story", "Hospitality, simply done"), features: c("Facilities", "Around the property"), testimonials: c("Guest reviews", "What guests say"), newsletter: c("Offers", "Hear about stay offers"), contact: c("Reservations", "Plan your stay") },
  ember: { about: c("From the kitchen", "Our table"), testimonials: c("At the table", "What diners say"), contact: c("Reservations", "Book a table or order") },
  muse: { about: c("The studio", "Our approach"), features: c("Services", "What we offer"), testimonials: c("Clients", "Kind words from clients"), contact: c("Book", "Book your appointment") },
  frame: { about: c("The studio", "Behind the lens"), testimonials: c("Clients", "What clients say"), contact: c("Enquiries", "Tell us about your shoot") },
  north: { features: c("Services", "What we do"), about: c("The studio", "How we work"), testimonials: c("Clients", "Client feedback"), contact: c("Start a project", "Tell us what you are building") },
  pure: { features: c("Services", "What we clean"), about: c("Our approach", "How a visit works"), testimonials: c("Reviews", "Words from our customers"), contact: c("Book a clean", "Request a booking") },
  forge: { about: c("Who we are", "Our approach to building"), features: c("Services", "What we build"), testimonials: c("Clients", "Client feedback"), contact: c("Request a quote", "Tell us about your project") },
};

// Per-template typography + corner style. These used to come ONLY from SIGNATURE_BASE, so every
// signature template (professional services, hotel, ...) rendered in the same fonts and radius.
const SIGNATURE_STYLE: Record<string, { font?: string; headlineFont?: string; radius?: string }> = {
  electra: { font: "'Inter', sans-serif", headlineFont: "'Inter', sans-serif", radius: "14px" },
  harvest: { font: "'Plus Jakarta Sans', sans-serif", headlineFont: "Georgia, 'Times New Roman', serif", radius: "20px" },
  haven: { font: "'Inter', sans-serif", headlineFont: "'Playfair Display', Georgia, serif", radius: "6px" },
  north: { headlineFont: "'Space Grotesk', sans-serif", radius: "10px" },
  frame: { font: "'Inter', sans-serif", headlineFont: "'Playfair Display', Georgia, serif", radius: "0px" },
  forge: { font: "'Inter', sans-serif", headlineFont: "'Space Grotesk', Impact, sans-serif", radius: "2px" },
  pure: { font: "'Plus Jakarta Sans', sans-serif", headlineFont: "'Plus Jakarta Sans', sans-serif", radius: "26px" },
  maison: { font: "'Inter', sans-serif", headlineFont: "'Playfair Display', Georgia, serif", radius: "4px" },
  hotel: { font: "'Plus Jakarta Sans', sans-serif", headlineFont: "Georgia, 'Times New Roman', serif", radius: "12px" },
  ember: { headlineFont: "'Playfair Display', Georgia, serif", radius: "8px" },
  muse: { font: "'Plus Jakarta Sans', sans-serif", headlineFont: "'Playfair Display', Georgia, serif", radius: "22px" },
  atelier: { headlineFont: "'Playfair Display', Georgia, serif", radius: "2px" },
  bloom: { font: "'Plus Jakarta Sans', sans-serif", headlineFont: "'Playfair Display', Georgia, serif", radius: "24px" },
  kinetic: { headlineFont: "'Space Grotesk', sans-serif", radius: "4px" },
};

function signatureTheme(data: Omit<TemplateTheme, "font" | "headlineFont" | "radius" | "sections"> & { signatureMode: string }): TemplateTheme & { signatureMode: string } {
  return { ...SIGNATURE_BASE, ...(SIGNATURE_STYLE[data.signatureMode] ?? {}), sections: SIGNATURE_SECTIONS[data.signatureMode] ?? SIGNATURE_BASE.sections, sectionCopy: SIGNATURE_SECTION_COPY[data.signatureMode], chrome: SIGNATURE_CHROME[data.signatureMode], heroVariant: HERO_VARIANT_BY_MODE[data.signatureMode], ...data };
}

export const SIGNATURE_TEMPLATES = [
  signatureTheme({ signatureMode: "electra", bg: "#F5F7FA", ink: "#101828", card: "#FFFFFF", accent: "#2563EB", accentSoft: "#93C5FD", muted: "#667085", border: "#E4E7EC", eyebrow: "Technology, refined.", headline: "Smarter gear. Better living.", sub: "Browse the latest devices and accessories, compare options and order online.", cta: "Shop the latest", layout: "grid", heroStyle: "split", catalogLabel: "Featured tech", density: "relaxed", surfaceDark: "#0B1220" }),
  signatureTheme({ signatureMode: "atelier", bg: "#F7F3EE", ink: "#211C1A", card: "#FFFDFC", accent: "#B56B45", accentSoft: "#E8B39A", muted: "#756C67", border: "#E8DED7", eyebrow: "The new season", headline: "Wear less. Choose better.", sub: "Discover new collections and timeless pieces, chosen with care.", cta: "Explore collection", layout: "grid", heroStyle: "fullbleed", catalogLabel: "The edit", density: "relaxed", surfaceDark: "#241E1B" }),
  signatureTheme({ signatureMode: "kinetic", bg: "#0B0B0D", ink: "#F5F5F5", card: "#141416", accent: "#D7FF3F", accentSoft: "#6F7F19", muted: "#A4A4AA", border: "#2A2A2E", eyebrow: "New drop / limited", headline: "Move different.", sub: "Fresh drops and everyday essentials. Find your pair and order online.", cta: "Shop the drop", layout: "grid", heroStyle: "fullbleed", catalogLabel: "Latest drop", density: "compact", surfaceDark: "#050506" }),
  signatureTheme({ signatureMode: "bloom", bg: "#FCF7F5", ink: "#302324", card: "#FFFFFF", accent: "#B86C7C", accentSoft: "#E8B6C0", muted: "#806E72", border: "#EEDFE3", eyebrow: "Rituals for every day", headline: "Beauty, made personal.", sub: "Skincare, makeup and self-care essentials. Find what suits you.", cta: "Shop beauty", layout: "grid", heroStyle: "split", catalogLabel: "The ritual edit", density: "relaxed", surfaceDark: "#302124" }),
  signatureTheme({ signatureMode: "haven", bg: "#F3F0E9", ink: "#25231F", card: "#FBFAF6", accent: "#7A6B50", accentSoft: "#C7B99A", muted: "#777168", border: "#DED8CC", eyebrow: "Objects for better living", headline: "Make room for beautiful.", sub: "Furniture and interiors for every room. Browse by room and order online.", cta: "Explore the home", layout: "grid", heroStyle: "fullbleed", catalogLabel: "Room edit", density: "relaxed", surfaceDark: "#2B2925" }),
  signatureTheme({ signatureMode: "harvest", bg: "#F6F8F1", ink: "#17351E", card: "#FFFFFF", accent: "#4E8B43", accentSoft: "#A8CF82", muted: "#667563", border: "#DDE7D7", eyebrow: "Fresh to your door", headline: "Good food, less friction.", sub: "Fresh groceries and everyday essentials. Browse by aisle and order online.", cta: "Shop groceries", layout: "grid", heroStyle: "split", catalogLabel: "Fresh picks", density: "compact", surfaceDark: "#17351E" }),
  signatureTheme({ signatureMode: "maison", bg: "#F5F0E8", ink: "#211B18", card: "#FFFDF8", accent: "#B78A52", accentSoft: "#DCC29D", muted: "#766D66", border: "#E4D8C8", eyebrow: "Stay somewhere beautiful", headline: "Your room is part of the journey.", sub: "Comfortable rooms and easy direct booking. Check availability and reserve your stay.", cta: "Find your room", layout: "grid", heroStyle: "fullbleed", catalogLabel: "Rooms & stays", density: "relaxed", surfaceDark: "#201A16" }),
  signatureTheme({ signatureMode: "hotel", bg: "#F4F0E9", ink: "#211B18", card: "#FBF8F2", accent: "#A97A45", accentSoft: "#D9BB96", muted: "#756D65", border: "#E2D8CA", eyebrow: "Hospitality, thoughtfully considered", headline: "A stay with a sense of place.", sub: "Discover our rooms, facilities and experiences, then enquire or book directly.", cta: "Discover the stay", layout: "list", heroStyle: "fullbleed", catalogLabel: "Rooms & suites", density: "relaxed", surfaceDark: "#171411" }),
  signatureTheme({ signatureMode: "ember", bg: "#171313", ink: "#FFF7EF", card: "#211B1B", accent: "#F08A3C", accentSoft: "#8C4722", muted: "#B7A8A1", border: "#352A29", eyebrow: "Good food. Good nights.", headline: "Come hungry. Leave happy.", sub: "Explore our menu, order online or reserve a table.", cta: "View the menu", layout: "list", heroStyle: "fullbleed", catalogLabel: "Tonight's menu", density: "relaxed", surfaceDark: "#0F0C0C" }),
  signatureTheme({ signatureMode: "muse", bg: "#F8F5F2", ink: "#292323", card: "#FFFFFF", accent: "#8C5C78", accentSoft: "#D3B0C4", muted: "#786E72", border: "#E7DFDB", eyebrow: "Your time, beautifully spent", headline: "Appointments that feel like a reset.", sub: "Browse our services and specialists, then book your appointment online.", cta: "Book an appointment", layout: "grid", heroStyle: "split", catalogLabel: "Services & packages", density: "relaxed", surfaceDark: "#292023" }),
  signatureTheme({ signatureMode: "frame", bg: "#F3F1ED", ink: "#1B1B1B", card: "#FBFAF7", accent: "#1B1B1B", accentSoft: "#8A8A8A", muted: "#777777", border: "#DCDAD5", eyebrow: "Stories worth remembering", headline: "Let the work speak.", sub: "See our portfolio, explore packages and tell us about your shoot.", cta: "View the portfolio", layout: "grid", heroStyle: "fullbleed", catalogLabel: "Selected work", density: "relaxed", surfaceDark: "#111111" }),
  signatureTheme({ signatureMode: "north", bg: "#EEF2F6", ink: "#0D1B2A", card: "#FFFFFF", accent: "#176B87", accentSoft: "#76B7C7", muted: "#617080", border: "#D9E1E8", eyebrow: "Strategy with substance", headline: "Clarity that compounds.", sub: "Explore our services and how we work, then start a conversation.", cta: "Start a project", layout: "list", heroStyle: "split", catalogLabel: "Capabilities", density: "relaxed", surfaceDark: "#0D1B2A" }),
  signatureTheme({ signatureMode: "pure", bg: "#F2F7F5", ink: "#17352D", card: "#FFFFFF", accent: "#2B8A70", accentSoft: "#8BC9B6", muted: "#647871", border: "#D9E8E2", eyebrow: "A cleaner space starts here", headline: "Clean you can count on.", sub: "Choose a cleaning service, see the areas we cover and book online.", cta: "Book a clean", layout: "grid", heroStyle: "split", catalogLabel: "Cleaning services", density: "relaxed", surfaceDark: "#17352D" }),
  signatureTheme({ signatureMode: "forge", bg: "#F1F0EC", ink: "#202321", card: "#FFFFFF", accent: "#C86B2A", accentSoft: "#D9A276", muted: "#6D706E", border: "#DCDDD8", eyebrow: "Built for the long run", headline: "Serious work. Properly built.", sub: "Explore our services and projects, then request a quote.", cta: "Request a quote", layout: "grid", heroStyle: "fullbleed", catalogLabel: "Projects & services", density: "relaxed", surfaceDark: "#202321" }),
] as const;

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

export const SIGNATURE_TEMPLATE_CATALOG = SIGNATURE_TEMPLATES as unknown as readonly SignatureTemplate[];

export function isSignatureTemplate(name: string | null | undefined): boolean {
  return !!name && SIGNATURE_TEMPLATE_CATALOG.some((t) => t.variationName === name);
}

export function getSignatureTheme(name: string | null | undefined): TemplateTheme & { signatureMode: string } {
  const found = SIGNATURE_TEMPLATE_CATALOG.find((t) => t.variationName === name);
  return found || SIGNATURE_TEMPLATE_CATALOG[0];
}

// ---------------------------------------------------------------------------
// Single source of truth for template names / categories / business support.
// template-registry.ts, prisma/seed.ts and the storefront runtime + preview all
// derive from these instead of keeping their own copies.
// ---------------------------------------------------------------------------

export const LEGACY_CATEGORY_BY_NAME: Readonly<Record<string, string>> = {
  [TEMPLATE_NAME]: "Retail",
  [TEMPLATE_NAME_HEENZY]: "Fashion", [TEMPLATE_NAME_HEENZY_BOUTIQUE]: "Fashion",
  [TEMPLATE_NAME_NOVA]: "Professional Services", [TEMPLATE_NAME_NOVA_IVORY]: "Professional Services",
  [TEMPLATE_NAME_VIOLET]: "Retail", [TEMPLATE_NAME_VIOLET_SUNSET]: "Retail",
  [TEMPLATE_NAME_PREMIUM]: "Retail", [TEMPLATE_NAME_HOMEVISTA]: "Real Estate",
  [TEMPLATE_NAME_RRW]: "Automotive", [TEMPLATE_NAME_MARKETPLACE]: "Retail",
  [TEMPLATE_NAME_ARCOVA]: "Professional Services", [TEMPLATE_NAME_RIVORA]: "Food & Groceries",
  [TEMPLATE_NAME_JUICELIFE]: "Food & Groceries", [TEMPLATE_NAME_FABTEX]: "Fashion",
};

/** Names of the legacy templates rendered by LegacyTemplateHome. */
export const LEGACY_TEMPLATE_NAMES: ReadonlySet<string> = new Set(Object.keys(LEGACY_CATEGORY_BY_NAME));

export const SIGNATURE_CATEGORY_BY_MODE: Readonly<Record<string, string>> = {
  electra: "Electronics", atelier: "Fashion", kinetic: "Fashion", bloom: "Beauty", haven: "Home & Furniture",
  harvest: "Food & Groceries", maison: "Hotel & Lodging", hotel: "Hotel & Lodging", ember: "Restaurant",
  muse: "Salon", frame: "Photography", north: "Agency", pure: "Cleaning", forge: "Construction",
};

/**
 * Business types each signature template is built for. If NO template targets a
 * business type (e.g. Church, Logistics) every template stays available so the
 * gallery is never empty -- see isTemplateCompatibleWithBusiness().
 */
export const SIGNATURE_SUPPORTS_BY_MODE: Readonly<Record<string, readonly string[]>> = {
  electra: ["Electronics", "Retail"], atelier: ["Fashion", "Retail"], kinetic: ["Fashion", "Retail"],
  bloom: ["Beauty", "Retail"], haven: ["Home & Furniture", "Retail"], harvest: ["Food & Groceries", "Retail", "Agriculture"],
  maison: ["Hotel & Lodging"], hotel: ["Hotel & Lodging"], ember: ["Restaurant"], muse: ["Salon", "Beauty"],
  frame: ["Photography", "Agency"], north: ["Agency", "Professional Services", "Software Development"],
  pure: ["Cleaning"], forge: ["Construction", "Real Estate"],
};
