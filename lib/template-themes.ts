/**
 * Storefront template system.
 *
 * Each niche has its own identity (copy, catalog label, section order,
 * a signature palette) — but a niche now offers MANY selectable templates,
 * not one. Real variation, not padding: every generated template differs
 * in at least color mode (light/dark) or accent color, AND hero layout.
 * Nothing is a duplicate with a different name.
 *
 * How the count is produced: for each niche, combine
 *   2 color modes (the niche's own "signature" mode + a neutral inverse)
 *   × N accent choices (the niche's base accent + its altAccents)
 *   × 3 hero layouts (centered / split / fullbleed)
 * Every niche defines at least 2 accents (2 × 2 × 3 = 12 templates,
 * comfortably over the 8 minimum); niches with 3 accents get 18. Which
 * niches get 3 vs 2 is fixed per niche below (not random per build — a
 * stable, reproducible catalog, not one that reshuffles on every deploy).
 *
 * Tier gating: templates are assigned a tierRank (1-4) cycling through the
 * generated list, so every tier — including Free — has real choices, and
 * each tier up unlocks more. See TIER_RANK below; keep in sync with
 * prisma/seed.ts's SUBSCRIPTIONS features.templateTier.
 */

export type HeroStyle = "centered" | "split" | "fullbleed";
export type Section = "hero" | "catalog" | "about" | "testimonials" | "contact" | "stats" | "features" | "newsletter" | "categories" | "deal";
export type ColorMode = "signature" | "inverse";

export type TemplateTheme = {
  bg: string;
  ink: string;
  card: string;
  accent: string;
  font: string;
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
  altAccents: string[]; // 1-2 more — determines whether this niche yields 12 or 18 templates
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

// Fixed neutral counterpart for whichever mode the niche's own palette ISN'T.
// Keeps every "inverse" variation cohesive rather than a jarring random flip.
const NEUTRAL_DARK = { bg: "#141414", ink: "#F2EFE9", card: "#1E1E1E" };
const NEUTRAL_LIGHT = { bg: "#FAF8F3", ink: "#1A1A1A", card: "#FFFFFF" };

function isDarkHex(hex: string): boolean {
  const h = hex.replace("#", "");
  const r = parseInt(h.substring(0, 2), 16);
  const g = parseInt(h.substring(2, 4), 16);
  const b = parseInt(h.substring(4, 6), 16);
  // Standard relative luminance approximation.
  return (0.299 * r + 0.587 * g + 0.114 * b) / 255 < 0.5;
}

export const NICHE_TEMPLATES: Record<string, NicheBase> = {
  "Restaurant & Food Delivery": {
    bg: "#1C1410", ink: "#F5EDE3", card: "#2A1F17", accent: "#E8722A", altAccents: ["#D9A441", "#C94F3D"],
    font: "'Bricolage Grotesque', sans-serif", radius: "1rem",
    eyebrow: "Now serving", headline: "Hot, fresh, delivered.", sub: "Order in minutes. Eat in twenty.", cta: "See the menu",
    layout: "grid", catalogLabel: "Menu", sections: ["hero", "catalog", "about", "testimonials", "contact"],
  },
  "Hotel & Short-let": {
    bg: "#12181C", ink: "#EFE9DF", card: "#1B242A", accent: "#B98F4E", altAccents: ["#6E93A8"],
    font: "'Fraunces', serif", radius: "0.5rem",
    eyebrow: "Book direct", headline: "Rest, easy.", sub: "Rooms and suites, ready when you are.", cta: "Check availability",
    layout: "grid", catalogLabel: "Rooms", sections: ["hero", "catalog", "about", "testimonials", "contact"],
  },
  "Fashion & Apparel": {
    bg: "#FBF7F0", ink: "#221A14", card: "#FFFFFF", accent: "#B4452C", altAccents: ["#8a4f9e", "#0B3D2E"],
    font: "'Fraunces', serif", radius: "0.75rem",
    eyebrow: "New arrivals", headline: "Made to be seen.", sub: "Ready-to-wear and bespoke pieces.", cta: "Shop the collection",
    layout: "grid", catalogLabel: "Collection", sections: ["hero", "catalog", "about", "contact"],
  },
  "Beauty & Cosmetics": {
    bg: "#FDF3F6", ink: "#2A171E", card: "#FFFFFF", accent: "#C6577B", altAccents: ["#B98F4E"],
    font: "'Fraunces', serif", radius: "1.25rem",
    eyebrow: "Self care", headline: "Glow, your way.", sub: "Skin, hair and beauty essentials.", cta: "Shop now",
    layout: "grid", catalogLabel: "Shop", sections: ["hero", "catalog", "testimonials", "contact"],
  },
  "Electronics & Gadgets": {
    bg: "#0D1117", ink: "#E6EDF3", card: "#161B22", accent: "#4F9EE8", altAccents: ["#8FB4FF", "#57C1A3"],
    font: "'Space Grotesk', sans-serif", radius: "0.5rem",
    eyebrow: "In stock", headline: "Tech that keeps up.", sub: "Genuine devices, fair prices.", cta: "Browse devices",
    layout: "grid", catalogLabel: "Devices", sections: ["hero", "categories", "stats", "catalog", "deal", "features", "testimonials", "newsletter", "contact"],
  },
  "Grocery & Supermarket": {
    bg: "#F4F8F1", ink: "#1D2B18", card: "#FFFFFF", accent: "#3E7C4F", altAccents: ["#D9A441"],
    font: "'Inter', sans-serif", radius: "0.5rem",
    eyebrow: "Fresh weekly", headline: "Everyday essentials.", sub: "Groceries delivered to your door.", cta: "Start shopping",
    layout: "grid", catalogLabel: "Groceries", sections: ["hero", "features", "categories", "deal", "catalog", "stats", "newsletter", "contact"],
  },
  "Furniture & Home Decor": {
    bg: "#F6F1E9", ink: "#2C2013", card: "#FFFFFF", accent: "#8A5A34", altAccents: ["#7a6a4f", "#0B3D2E"],
    font: "'Fraunces', serif", radius: "0.5rem",
    eyebrow: "Handcrafted", headline: "Furniture with a story.", sub: "Built to last generations.", cta: "View pieces",
    layout: "grid", catalogLabel: "Pieces", sections: ["hero", "catalog", "about", "contact"],
  },
  "Photography Studio": {
    bg: "#FAFAF8", ink: "#191C1A", card: "#FFFFFF", accent: "#0B3D2E", altAccents: ["#B4452C"],
    font: "'Space Grotesk', sans-serif", radius: "0.25rem",
    eyebrow: "Portfolio", headline: "Frames worth keeping.", sub: "Portraits, products & campaigns.", cta: "See the work",
    layout: "grid", catalogLabel: "Portfolio", sections: ["hero", "catalog", "about", "testimonials", "contact"],
  },
  "Videography & Film": {
    bg: "#0E0F12", ink: "#EDEDEF", card: "#17181D", accent: "#8FB4FF", altAccents: ["#D9A441", "#E06A8F"],
    font: "'Space Grotesk', sans-serif", radius: "0.25rem",
    eyebrow: "Now booking", headline: "Your story, beautifully shot.", sub: "Weddings, events, brand films.", cta: "Book a session",
    layout: "grid", catalogLabel: "Showreel", sections: ["hero", "catalog", "about", "testimonials", "contact"],
  },
  "Creative Agency": {
    bg: "#0B0B10", ink: "#EDEDF2", card: "#16161D", accent: "#D9A441", altAccents: ["#8FB4FF"],
    font: "'Space Grotesk', sans-serif", radius: "0.5rem",
    eyebrow: "Full service", headline: "Ideas, shipped.", sub: "Strategy, design and growth.", cta: "See our work",
    layout: "list", catalogLabel: "Services", sections: ["hero", "about", "catalog", "testimonials", "contact"],
  },
  "Law Firm & Legal Services": {
    bg: "#101418", ink: "#E9ECEF", card: "#1A2027", accent: "#B98F4E", altAccents: ["#6E93A8"],
    font: "'Fraunces', serif", radius: "0.25rem",
    eyebrow: "Counsel you can trust", headline: "Clarity in complexity.", sub: "Practical legal guidance.", cta: "Book a consultation",
    layout: "list", catalogLabel: "Practice Areas", sections: ["hero", "about", "catalog", "testimonials", "contact"],
  },
  "Hospital & Clinic": {
    bg: "#F2F8F7", ink: "#122522", card: "#FFFFFF", accent: "#2E9E8C", altAccents: ["#4F9EE8"],
    font: "'Inter', sans-serif", radius: "0.75rem",
    eyebrow: "Now accepting patients", headline: "Care you can count on.", sub: "Book an appointment today.", cta: "Book appointment",
    layout: "list", catalogLabel: "Services", sections: ["hero", "catalog", "about", "contact"],
  },
  Pharmacy: {
    bg: "#F4FAF9", ink: "#0F2521", card: "#FFFFFF", accent: "#1E8C6E", altAccents: ["#3E7C4F"],
    font: "'Inter', sans-serif", radius: "0.75rem",
    eyebrow: "Open now", headline: "Your health, sorted.", sub: "Medications and wellness essentials.", cta: "Shop essentials",
    layout: "grid", catalogLabel: "Shop", sections: ["hero", "catalog", "contact"],
  },
  "Auto Repair & Mechanic": {
    bg: "#15130F", ink: "#EFE9DF", card: "#211E17", accent: "#E8722A", altAccents: ["#4F9EE8"],
    font: "'Space Grotesk', sans-serif", radius: "0.25rem",
    eyebrow: "Certified", headline: "Fixed right, first time.", sub: "Diagnostics, repairs and servicing.", cta: "Book a service",
    layout: "list", catalogLabel: "Services", sections: ["hero", "catalog", "about", "testimonials", "contact"],
  },
  "Hair & Beauty Salon": {
    bg: "#FBF2F5", ink: "#2A1720", card: "#FFFFFF", accent: "#C6577B", altAccents: ["#8A9A6E"],
    font: "'Fraunces', serif", radius: "1.25rem",
    eyebrow: "Walk-ins welcome", headline: "Look good, feel better.", sub: "Cuts, color and styling.", cta: "Book a slot",
    layout: "grid", catalogLabel: "Services", sections: ["hero", "catalog", "testimonials", "contact"],
  },
  "Spa & Wellness": {
    bg: "#F5F3EC", ink: "#2A2A20", card: "#FFFFFF", accent: "#8A9A6E", altAccents: ["#C6577B"],
    font: "'Fraunces', serif", radius: "1.5rem",
    eyebrow: "Unwind", headline: "Stillness, delivered.", sub: "Massage, facials and rituals.", cta: "Book your session",
    layout: "grid", catalogLabel: "Treatments", sections: ["hero", "catalog", "about", "testimonials", "contact"],
  },
  "Church & Ministry": {
    bg: "#F7F4EC", ink: "#231F16", card: "#FFFFFF", accent: "#B98F4E", altAccents: ["#8A5A34"],
    font: "'Fraunces', serif", radius: "0.25rem",
    eyebrow: "Join us", headline: "A place to belong.", sub: "Services, events and community.", cta: "Plan your visit",
    layout: "list", catalogLabel: "Programs", sections: ["hero", "about", "catalog", "contact"],
  },
  "School & Education": {
    bg: "#EEF3FB", ink: "#152238", card: "#FFFFFF", accent: "#3D5FA6", altAccents: ["#2E9E8C"],
    font: "'Inter', sans-serif", radius: "0.5rem",
    eyebrow: "Admissions open", headline: "Learning that lasts.", sub: "Programs for every stage.", cta: "Apply now",
    layout: "list", catalogLabel: "Programs", sections: ["hero", "about", "catalog", "testimonials", "contact"],
  },
  "Construction & Contracting": {
    bg: "#171512", ink: "#EFE9DF", card: "#221F1A", accent: "#D9A441", altAccents: ["#E8722A"],
    font: "'Space Grotesk', sans-serif", radius: "0.25rem",
    eyebrow: "Licensed & insured", headline: "Built to spec.", sub: "Residential and commercial projects.", cta: "Get a quote",
    layout: "list", catalogLabel: "Projects", sections: ["hero", "catalog", "about", "testimonials", "contact"],
  },
  "Architecture & Design Studio": {
    bg: "#FAFAF9", ink: "#1A1A1A", card: "#FFFFFF", accent: "#B4452C", altAccents: ["#4F9EE8"],
    font: "'Space Grotesk', sans-serif", radius: "0",
    eyebrow: "Portfolio", headline: "Form follows function.", sub: "Residential and commercial design.", cta: "View projects",
    layout: "grid", catalogLabel: "Projects", sections: ["hero", "catalog", "about", "contact"],
  },
  "Engineering Services": {
    bg: "#0F1720", ink: "#E6EDF3", card: "#182430", accent: "#4F9EE8", altAccents: ["#D9A441"],
    font: "'Space Grotesk', sans-serif", radius: "0.25rem",
    eyebrow: "Precision", headline: "Engineered right.", sub: "Structural, electrical & mechanical.", cta: "Discuss a project",
    layout: "list", catalogLabel: "Capabilities", sections: ["hero", "catalog", "about", "contact"],
  },
  "Real Estate & Property": {
    bg: "#F7F5EF", ink: "#12281E", card: "#FFFFFF", accent: "#0B3D2E", altAccents: ["#B98F4E", "#3D5FA6"],
    font: "'Fraunces', serif", radius: "0.5rem",
    eyebrow: "New listings", headline: "Find your next address.", sub: "Rentals, sales and shortlets.", cta: "Browse listings",
    layout: "grid", catalogLabel: "Listings", sections: ["hero", "catalog", "about", "testimonials", "contact"],
  },
  "Freelancer & Portfolio": {
    bg: "#0B0B10", ink: "#EDEDF2", card: "#16161D", accent: "#8FB4FF", altAccents: ["#D9A441"],
    font: "'Space Grotesk', sans-serif", radius: "0.5rem",
    eyebrow: "Available for hire", headline: "Let's build something.", sub: "Project-based and retainer work.", cta: "Get a quote",
    layout: "grid", catalogLabel: "Work", sections: ["hero", "catalog", "about", "testimonials", "contact"],
  },
  "Sneakers & Streetwear": {
    bg: "#0A0A0A", ink: "#F5F5F0", card: "#161616", accent: "#FF6A1A", altAccents: ["#FFC93C", "#3DDC97"],
    font: "'Space Grotesk', sans-serif", radius: "0.25rem",
    eyebrow: "Fresh drops weekly", headline: "Reimagined comfort.", sub: "Not just shoes — a lifestyle.", cta: "Shop the drop",
    layout: "grid", catalogLabel: "Sneakers", sections: ["hero", "stats", "categories", "catalog", "deal", "features", "testimonials", "newsletter", "contact"],
  },
  "General Marketplace": {
    bg: "#FBF6EF", ink: "#221A10", card: "#FFFFFF", accent: "#E8722A", altAccents: ["#0B3D2E", "#3D5FA6"],
    font: "'Inter', sans-serif", radius: "0.75rem",
    eyebrow: "Shop more, save more", headline: "Everything you need, one stop.", sub: "Quality picks, everyday prices.", cta: "Explore deals",
    layout: "grid", catalogLabel: "Shop", sections: ["hero", "features", "categories", "deal", "catalog", "stats", "testimonials", "newsletter", "contact"],
  },
};

export const NICHE_NAMES = Object.keys(NICHE_TEMPLATES);

/** Generates every selectable template for one niche — see file header for the formula. */
export function generateNicheVariations(nicheName: string): GeneratedTemplate[] {
  const base = NICHE_TEMPLATES[nicheName];
  if (!base) return [];

  const signatureIsDark = isDarkHex(base.bg);
  const modes: Record<ColorMode, { bg: string; ink: string; card: string }> = {
    signature: { bg: base.bg, ink: base.ink, card: base.card },
    inverse: signatureIsDark ? NEUTRAL_LIGHT : NEUTRAL_DARK,
  };
  const accents = [base.accent, ...base.altAccents];

  const combos: GeneratedTemplate[] = [];
  let i = 0;
  for (const mode of ["signature", "inverse"] as ColorMode[]) {
    for (const accent of accents) {
      for (const heroStyle of HERO_STYLES) {
        const tierRank = ((Math.floor(i / 2) % 4) + 1) as 1 | 2 | 3 | 4; // cycles 1,1,2,2,3,3,4,4,...
        combos.push({
          ...modes[mode],
          accent,
          font: base.font,
          radius: base.radius,
          eyebrow: base.eyebrow,
          headline: base.headline,
          sub: base.sub,
          cta: base.cta,
          layout: base.layout,
          heroStyle,
          catalogLabel: base.catalogLabel,
          sections: base.sections,
          variationName: `${mode === "signature" ? "Signature" : "Midnight/Light"} · ${accent} · ${heroStyle}`,
          tierRank,
        });
        i++;
      }
    }
  }
  return combos;
}

// Deterministic fallback for a category with no curated base (shouldn't
// happen with the 23 above, but keeps rendering safe if one is ever missing).
function hashString(s: string): number {
  let h = 0;
  for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) >>> 0;
  return h;
}

export function getTemplateTheme(category: string | undefined, storeName: string): TemplateTheme {
  if (category && NICHE_TEMPLATES[category]) {
    const b = NICHE_TEMPLATES[category];
    return { ...b, heroStyle: "centered" };
  }
  const pool = Object.values(NICHE_TEMPLATES);
  const b = pool[hashString(category ?? storeName) % pool.length];
  return { ...b, heroStyle: "centered" };
}

/** Merge a store's saved overrides (from Settings) on top of the template default. */
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
