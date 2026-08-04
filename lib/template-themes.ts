/**
 * Storefront template theming.
 *
 * Previously the storefront page ignored `store.template` entirely and every
 * store rendered as an unstyled list — that's why "there's no template for
 * the user website." This module gives every StoreTemplate.category a real,
 * distinct visual identity (palette, type, hero copy, layout), and the
 * storefront reads it. Vendor overrides in `store.themeColors` /
 * `store.fontFamily` (set from Settings) win over the template default —
 * same pattern as a Shopify theme + a merchant's customizations.
 */

export type TemplateTheme = {
  bg: string;
  ink: string;
  card: string;
  accent: string;
  font: string; // a Google-ish font stack, loaded via next/font in layout if desired
  radius: string;
  eyebrow: string;
  headline: string;
  sub: string;
  cta: string;
  layout: "grid" | "list";
};

const CURATED: Record<string, TemplateTheme> = {
  Restaurant: { bg: "#1C1410", ink: "#F5EDE3", card: "#2A1F17", accent: "#E8722A", font: "'Bricolage Grotesque', sans-serif", radius: "1rem", eyebrow: "Now serving", headline: "Hot, fresh, delivered.", sub: "Order in minutes.", cta: "See the menu", layout: "grid" },
  "Restaurant Delivery": { bg: "#1C1410", ink: "#F5EDE3", card: "#2A1F17", accent: "#E8722A", font: "'Bricolage Grotesque', sans-serif", radius: "1rem", eyebrow: "Delivering today", headline: "Cooked to order.", sub: "Delivered while it's hot.", cta: "Order now", layout: "grid" },
  Hotel: { bg: "#12181C", ink: "#EFE9DF", card: "#1B242A", accent: "#B98F4E", font: "'Fraunces', serif", radius: "0.5rem", eyebrow: "Book direct", headline: "Rest, easy.", sub: "Rooms and suites, ready when you are.", cta: "Check availability", layout: "grid" },
  "Fashion Store": { bg: "#FBF7F0", ink: "#221A14", card: "#FFFFFF", accent: "#B4452C", font: "'Fraunces', serif", radius: "0.75rem", eyebrow: "New arrivals", headline: "Made to be seen.", sub: "Ready-to-wear and bespoke pieces.", cta: "Shop the collection", layout: "grid" },
  "Beauty Store": { bg: "#FDF3F6", ink: "#2A171E", card: "#FFFFFF", accent: "#C6577B", font: "'Fraunces', serif", radius: "1.25rem", eyebrow: "Self care", headline: "Glow, your way.", sub: "Skin, hair and beauty essentials.", cta: "Shop now", layout: "grid" },
  Electronics: { bg: "#0D1117", ink: "#E6EDF3", card: "#161B22", accent: "#4F9EE8", font: "'Space Grotesk', sans-serif", radius: "0.5rem", eyebrow: "In stock", headline: "Tech that keeps up.", sub: "Genuine devices, fair prices.", cta: "Browse devices", layout: "grid" },
  Supermarket: { bg: "#F4F8F1", ink: "#1D2B18", card: "#FFFFFF", accent: "#3E7C4F", font: "'Inter', sans-serif", radius: "0.5rem", eyebrow: "Fresh weekly", headline: "Everyday essentials.", sub: "Groceries delivered to your door.", cta: "Start shopping", layout: "grid" },
  Furniture: { bg: "#F6F1E9", ink: "#2C2013", card: "#FFFFFF", accent: "#8A5A34", font: "'Fraunces', serif", radius: "0.5rem", eyebrow: "Handcrafted", headline: "Furniture with a story.", sub: "Built to last generations.", cta: "View pieces", layout: "grid" },
  Photography: { bg: "#FAFAF8", ink: "#191C1A", card: "#FFFFFF", accent: "#0B3D2E", font: "'Space Grotesk', sans-serif", radius: "0.25rem", eyebrow: "Portfolio", headline: "Frames worth keeping.", sub: "Portraits, products & campaigns.", cta: "See the work", layout: "grid" },
  Videography: { bg: "#0E0F12", ink: "#EDEDEF", card: "#17181D", accent: "#8FB4FF", font: "'Space Grotesk', sans-serif", radius: "0.25rem", eyebrow: "Now booking", headline: "Your story, beautifully shot.", sub: "Weddings, events, brand films.", cta: "Book a session", layout: "grid" },
  Agency: { bg: "#0B0B10", ink: "#EDEDF2", card: "#16161D", accent: "#D9A441", font: "'Space Grotesk', sans-serif", radius: "0.5rem", eyebrow: "Full service", headline: "Ideas, shipped.", sub: "Strategy, design and growth.", cta: "See our work", layout: "list" },
  "Law Firm": { bg: "#101418", ink: "#E9ECEF", card: "#1A2027", accent: "#B98F4E", font: "'Fraunces', serif", radius: "0.25rem", eyebrow: "Counsel you can trust", headline: "Clarity in complexity.", sub: "Practical legal guidance.", cta: "Book a consultation", layout: "list" },
  Hospital: { bg: "#F2F8F7", ink: "#122522", card: "#FFFFFF", accent: "#2E9E8C", font: "'Inter', sans-serif", radius: "0.75rem", eyebrow: "Now accepting patients", headline: "Care you can count on.", sub: "Book an appointment today.", cta: "Book appointment", layout: "list" },
  Pharmacy: { bg: "#F4FAF9", ink: "#0F2521", card: "#FFFFFF", accent: "#1E8C6E", font: "'Inter', sans-serif", radius: "0.75rem", eyebrow: "Open now", headline: "Your health, sorted.", sub: "Medications and wellness essentials.", cta: "Shop essentials", layout: "grid" },
  Mechanic: { bg: "#15130F", ink: "#EFE9DF", card: "#211E17", accent: "#E8722A", font: "'Space Grotesk', sans-serif", radius: "0.25rem", eyebrow: "Certified", headline: "Fixed right, first time.", sub: "Diagnostics, repairs and servicing.", cta: "Book a service", layout: "list" },
  Salon: { bg: "#FBF2F5", ink: "#2A1720", card: "#FFFFFF", accent: "#C6577B", font: "'Fraunces', serif", radius: "1.25rem", eyebrow: "Walk-ins welcome", headline: "Look good, feel better.", sub: "Cuts, color and styling.", cta: "Book a slot", layout: "grid" },
  Spa: { bg: "#F5F3EC", ink: "#2A2A20", card: "#FFFFFF", accent: "#8A9A6E", font: "'Fraunces', serif", radius: "1.5rem", eyebrow: "Unwind", headline: "Stillness, delivered.", sub: "Massage, facials and rituals.", cta: "Book your session", layout: "grid" },
  Church: { bg: "#F7F4EC", ink: "#231F16", card: "#FFFFFF", accent: "#B98F4E", font: "'Fraunces', serif", radius: "0.25rem", eyebrow: "Join us", headline: "A place to belong.", sub: "Services, events and community.", cta: "Plan your visit", layout: "list" },
  School: { bg: "#EEF3FB", ink: "#152238", card: "#FFFFFF", accent: "#3D5FA6", font: "'Inter', sans-serif", radius: "0.5rem", eyebrow: "Admissions open", headline: "Learning that lasts.", sub: "Programs for every stage.", cta: "Apply now", layout: "list" },
  Construction: { bg: "#171512", ink: "#EFE9DF", card: "#221F1A", accent: "#D9A441", font: "'Space Grotesk', sans-serif", radius: "0.25rem", eyebrow: "Licensed & insured", headline: "Built to spec.", sub: "Residential and commercial projects.", cta: "Get a quote", layout: "list" },
  Architecture: { bg: "#FAFAF9", ink: "#1A1A1A", card: "#FFFFFF", accent: "#1A1A1A", font: "'Space Grotesk', sans-serif", radius: "0", eyebrow: "Portfolio", headline: "Form follows function.", sub: "Residential and commercial design.", cta: "View projects", layout: "grid" },
  Engineering: { bg: "#0F1720", ink: "#E6EDF3", card: "#182430", accent: "#4F9EE8", font: "'Space Grotesk', sans-serif", radius: "0.25rem", eyebrow: "Precision", headline: "Engineered right.", sub: "Structural, electrical & mechanical.", cta: "Discuss a project", layout: "list" },
  "Real Estate": { bg: "#F7F5EF", ink: "#12281E", card: "#FFFFFF", accent: "#0B3D2E", font: "'Fraunces', serif", radius: "0.5rem", eyebrow: "New listings", headline: "Find your next address.", sub: "Rentals, sales and shortlets.", cta: "Browse listings", layout: "grid" },
  "Personal Portfolio": { bg: "#0B0B10", ink: "#EDEDF2", card: "#16161D", accent: "#8FB4FF", font: "'Space Grotesk', sans-serif", radius: "0.5rem", eyebrow: "Selected work", headline: "Hi, I'm glad you're here.", sub: "A look at what I've been building.", cta: "See my work", layout: "grid" },
  Freelancer: { bg: "#FAFAF8", ink: "#191C1A", card: "#FFFFFF", accent: "#0B3D2E", font: "'Inter', sans-serif", radius: "0.5rem", eyebrow: "Available for hire", headline: "Let's build something.", sub: "Project-based and retainer work.", cta: "Get a quote", layout: "list" },
  Marketplace: { bg: "#F7F5EF", ink: "#12281E", card: "#FFFFFF", accent: "#D9A441", font: "'Inter', sans-serif", radius: "0.75rem", eyebrow: "Verified sellers", headline: "Everything, in one place.", sub: "Products and services from trusted vendors.", cta: "Start browsing", layout: "grid" },
};

// Deterministic fallback so any category not curated above still gets a
// distinct, stable-per-name look instead of one generic default.
const FALLBACK_PALETTES: Omit<TemplateTheme, "eyebrow" | "headline" | "sub" | "cta" | "layout">[] = [
  { bg: "#F7F5EF", ink: "#12281E", card: "#FFFFFF", accent: "#0B3D2E", font: "'Inter', sans-serif", radius: "0.75rem" },
  { bg: "#101014", ink: "#EDEDF2", card: "#1A1A20", accent: "#D9A441", font: "'Space Grotesk', sans-serif", radius: "0.5rem" },
  { bg: "#FBF7F0", ink: "#221A14", card: "#FFFFFF", accent: "#B4452C", font: "'Fraunces', serif", radius: "1rem" },
  { bg: "#0D1117", ink: "#E6EDF3", card: "#161B22", accent: "#4F9EE8", font: "'Space Grotesk', sans-serif", radius: "0.25rem" },
  { bg: "#F4F8F1", ink: "#1D2B18", card: "#FFFFFF", accent: "#3E7C4F", font: "'Inter', sans-serif", radius: "0.5rem" },
];

function hashString(s: string): number {
  let h = 0;
  for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) >>> 0;
  return h;
}

export function getTemplateTheme(category: string | undefined, storeName: string): TemplateTheme {
  if (category && CURATED[category]) return CURATED[category];
  const palette = FALLBACK_PALETTES[hashString(category ?? storeName) % FALLBACK_PALETTES.length];
  return {
    ...palette,
    eyebrow: "Welcome",
    headline: storeName,
    sub: "Browse our products and services.",
    cta: "Explore",
    layout: "grid",
  };
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
