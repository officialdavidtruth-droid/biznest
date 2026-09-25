/**
 * BizNest email marketing templates.
 *
 * Every design is a pure function of (brand, content) -> email-safe HTML
 * (tables + inline styles, no CSS variables, no background images), so the
 * same code powers the live preview, the exported HTML and the real send.
 *
 * Everything a merchant sees in a design is editable through
 * `MarketingContent` (text, offer/event details, highlights, featured items,
 * buttons) and `MarketingStyle` (colours, font, button shape, alignment,
 * which sections show). Anything left unset falls back to the store brand.
 */

export type MarketingTemplateId =
  | "announcement"
  | "launch"
  | "showcase"
  | "newsletter"
  | "promotion"
  | "flash"
  | "coupon"
  | "welcome"
  | "thankyou"
  | "winback"
  | "review"
  | "event"
  | "holiday"
  | "service"
  | "hospitality"
  | "restaurant"
  | "letter"
  | "luxury"
  | "editorial"
  | "product_grid"
  | "premium_offer"
  | "hotel_signature"
  | "minimal_pro"
  | "ref_confirmation"
  | "ref_offer"
  | "ref_catalog"
  | "ref_journey"
  | "ref_thankyou"
  | "ref_editorial"
  | "ref_pricing"
  | "ref_hotel"
  | "ref_restaurant"
  | "ref_food_catalog"
  | "ref_dark_menu"
  | "ref_product_launch";

export type MarketingTemplateCategory = "news" | "sales" | "customers" | "events" | "industry";

/** Optional building blocks a design can use beyond the always-editable core fields. */
export type MarketingExtra = "items" | "highlights" | "offer" | "event" | "secondaryCta";

export type MarketingFontKey = "brand" | "sans" | "modern" | "serif" | "elegant" | "rounded";
export type MarketingButtonShape = "rounded" | "pill" | "square";
export type MarketingAlign = "left" | "center";

export type MarketingItem = {
  kind?: "product" | "service";
  name: string;
  description?: string | null;
  price?: string | null;
  imageUrl?: string | null;
  href?: string | null;
};

export type MarketingBrand = {
  name: string;
  storeId: string;
  slug: string;
  logoUrl?: string | null;
  bannerUrl?: string | null;
  primary: string;
  secondary: string;
  accent: string;
  background: string;
  text: string;
  fontFamily: string;
  contactEmail?: string | null;
  contactPhone?: string | null;
  socialLinks?: Record<string, string> | null;
  businessType?: string | null;
  businessDescription?: string | null;
  sellsProducts: boolean;
  offersServices: boolean;
};

/** Per-email look overrides. Undefined = use the store's brand. */
export type MarketingStyle = {
  primary?: string;
  button?: string;
  background?: string;
  text?: string;
  font?: MarketingFontKey;
  buttonShape?: MarketingButtonShape;
  align?: MarketingAlign;
  showLogo?: boolean;
  showImage?: boolean;
  showItems?: boolean;
  showFooterDetails?: boolean;
};

export type MarketingContent = {
  eyebrow: string;
  headline: string;
  body: string;
  ctaLabel: string;
  ctaUrl: string;
  imageUrl?: string | null;
  items: MarketingItem[];
  previewText?: string;
  secondaryCtaLabel?: string;
  secondaryCtaUrl?: string;
  highlights?: string[];
  offerLabel?: string;
  couponCode?: string;
  offerNote?: string;
  eventDate?: string;
  eventTime?: string;
  eventLocation?: string;
  signature?: string;
  closingNote?: string;
  style?: MarketingStyle;
};

/** What the composer edits and the server action receives. */
export type MarketingCampaignInput = MarketingContent & {
  template: MarketingTemplateId;
  subject: string;
};

export type MarketingDefaults = MarketingContent & { subject: string };

const APP_URL = process.env.NEXT_PUBLIC_APP_URL ?? "https://biznest.space";

/* -------------------------------------------------------------------------- */
/*  Template catalogue                                                         */
/* -------------------------------------------------------------------------- */

export type MarketingTemplateMeta = {
  id: MarketingTemplateId;
  name: string;
  description: string;
  icon: string;
  category: MarketingTemplateCategory;
  extras: MarketingExtra[];
  align: MarketingAlign;
  font: MarketingFontKey;
  /** Template-specific wording for editor fields (the email itself is unaffected). */
  labels?: Partial<Record<"eyebrow" | "highlights" | "offerLabel" | "offerNote" | "couponCode" | "image", string>>;
};

export const MARKETING_CATEGORIES: Array<{ id: MarketingTemplateCategory | "all"; label: string }> = [
  { id: "all", label: "All designs" },
  { id: "sales", label: "Sales & offers" },
  { id: "news", label: "News & updates" },
  { id: "customers", label: "Customer care" },
  { id: "events", label: "Events & seasons" },
  { id: "industry", label: "By industry" },
];

export const MARKETING_TEMPLATES: MarketingTemplateMeta[] = [
  { id: "luxury", name: "Luxury Signature", description: "Premium editorial layout with refined typography and curated content.", icon: "◇", category: "industry", extras: ["items", "highlights", "secondaryCta"], align: "left", font: "elegant" },
  { id: "editorial", name: "Editorial Story", description: "Magazine-inspired storytelling layout for sophisticated campaigns.", icon: "▤", category: "news", extras: ["items", "highlights", "secondaryCta"], align: "left", font: "serif" },
  { id: "product_grid", name: "Curated Collection", description: "Premium product or service showcase with clean pricing.", icon: "▦", category: "sales", extras: ["items", "secondaryCta"], align: "center", font: "modern" },
  { id: "premium_offer", name: "Premium Offer", description: "High-end promotional layout for discounts and limited campaigns.", icon: "◆", category: "sales", extras: ["offer", "items", "secondaryCta"], align: "center", font: "elegant" },
  { id: "hotel_signature", name: "Hotel Signature", description: "Luxury hospitality campaign for rooms, rates and reservations.", icon: "⌂", category: "industry", extras: ["items", "highlights", "offer", "secondaryCta"], align: "left", font: "elegant" },
  { id: "minimal_pro", name: "Minimal Professional", description: "Clean executive layout for agencies, consultants and B2B brands.", icon: "—", category: "industry", extras: ["items", "highlights", "secondaryCta"], align: "left", font: "modern" },
  { id: "ref_confirmation", name: "Booking Confirmation", description: "Dark hospitality-style confirmation with hero, details and action cards.", icon: "✓", category: "customers", extras: ["items", "highlights", "secondaryCta"], align: "left", font: "modern" },
  { id: "ref_offer", name: "Signature Offer", description: "Image-led promotional offer with bold discount block and feature sections.", icon: "%", category: "sales", extras: ["offer", "items", "highlights", "secondaryCta"], align: "center", font: "modern" },
  { id: "ref_catalog", name: "Curated Catalog", description: "Travel and hospitality catalog with featured cards and editorial footer.", icon: "▦", category: "industry", extras: ["items", "highlights", "secondaryCta"], align: "left", font: "modern" },
  { id: "ref_journey", name: "Journey & Experiences", description: "Travel editorial layout with destination feature, tips and packages.", icon: "✈", category: "news", extras: ["items", "highlights", "secondaryCta"], align: "left", font: "modern" },
  { id: "ref_thankyou", name: "Customer Thank You", description: "Order confirmation / thank-you layout with process timeline.", icon: "♥", category: "customers", extras: ["highlights", "secondaryCta"], align: "center", font: "modern" },
  { id: "ref_editorial", name: "Brand Editorial", description: "Long-form editorial product or service story with comparison blocks.", icon: "▤", category: "news", extras: ["items", "highlights", "secondaryCta"], align: "left", font: "serif" },
  { id: "ref_pricing", name: "Pricing & Packages", description: "Pricing announcement with two-column value story and CTA.", icon: "₦", category: "sales", extras: ["offer", "highlights", "secondaryCta"], align: "left", font: "serif" },
  { id: "ref_hotel", name: "Hotel Showcase", description: "Accommodation showcase with rooms, review, dining and amenities.", icon: "⌂", category: "industry", extras: ["items", "highlights", "secondaryCta"], align: "left", font: "serif" },
  { id: "ref_restaurant", name: "Restaurant Story", description: "Restaurant campaign with featured dish, story and menu cards.", icon: "◉", category: "industry", extras: ["items", "highlights", "secondaryCta"], align: "left", font: "modern" },
  { id: "ref_food_catalog", name: "Food Catalog", description: "Food menu catalog with multiple product cards and social footer.", icon: "🍽", category: "industry", extras: ["items", "secondaryCta"], align: "left", font: "modern" },
  { id: "ref_dark_menu", name: "Dark Menu", description: "High-contrast restaurant menu with category tiles and reservation CTA.", icon: "◈", category: "industry", extras: ["items", "highlights", "secondaryCta"], align: "center", font: "modern" },
  { id: "ref_product_launch", name: "Product Launch", description: "Premium product launch with hero image, benefits and final CTA.", icon: "★", category: "sales", extras: ["items", "highlights", "secondaryCta"], align: "center", font: "modern" },
  { id: "announcement", name: "Big announcement", description: "Full-width hero, story and button for launches and news.", icon: "✦", category: "news", extras: ["highlights", "items", "secondaryCta"], align: "left", font: "brand", labels: { highlights: "Key points" } },
  { id: "launch", name: "Product launch", description: "Dark, bold reveal with feature rows for something new.", icon: "★", category: "news", extras: ["highlights", "items", "secondaryCta"], align: "left", font: "brand", labels: { eyebrow: "Badge (e.g. New)", highlights: "Key features" } },
  { id: "showcase", name: "Product showcase", description: "Image-led grid for collections and best sellers.", icon: "▦", category: "news", extras: ["items", "secondaryCta"], align: "left", font: "brand" },
  { id: "newsletter", name: "Monthly newsletter", description: "Editorial masthead with a thumbnail list of updates.", icon: "✉", category: "news", extras: ["highlights", "items", "secondaryCta"], align: "left", font: "brand", labels: { eyebrow: "Issue label (e.g. September update)", highlights: "Quick reads" } },
  { id: "promotion", name: "Offer / promotion", description: "Colour-block sale layout with a big offer and code.", icon: "%", category: "sales", extras: ["offer", "items", "secondaryCta"], align: "center", font: "brand" },
  { id: "flash", name: "Flash sale", description: "High-urgency dark layout with a giant discount figure.", icon: "⚡", category: "sales", extras: ["offer", "items"], align: "center", font: "brand", labels: { eyebrow: "Badge (e.g. Flash sale)", offerNote: "Deadline line" } },
  { id: "coupon", name: "Discount code", description: "A ticket-style coupon your customers can screenshot.", icon: "◈", category: "sales", extras: ["offer"], align: "center", font: "brand" },
  { id: "winback", name: "We miss you", description: "Win back quiet customers or recover a forgotten cart.", icon: "↺", category: "customers", extras: ["offer", "items", "secondaryCta"], align: "center", font: "brand" },
  { id: "welcome", name: "Welcome", description: "Greet new subscribers and set expectations.", icon: "☺", category: "customers", extras: ["highlights", "offer", "secondaryCta"], align: "left", font: "brand", labels: { highlights: "What they can expect", couponCode: "Welcome code (optional)" } },
  { id: "thankyou", name: "Thank you", description: "Warm post-purchase note with what happens next.", icon: "♥", category: "customers", extras: ["highlights", "offer", "items", "secondaryCta"], align: "center", font: "brand", labels: { highlights: "What happens next", couponCode: "Repeat-order code (optional)" } },
  { id: "review", name: "Review request", description: "Ask for feedback with a star rating prompt.", icon: "☆", category: "customers", extras: ["items", "secondaryCta"], align: "center", font: "brand" },
  { id: "letter", name: "Personal note", description: "Plain, letter-style email that feels hand-written.", icon: "✎", category: "customers", extras: ["secondaryCta"], align: "left", font: "serif", labels: { image: "Optional photo" } },
  { id: "event", name: "Event invitation", description: "Date, time and place at a glance, with an RSVP button.", icon: "◷", category: "events", extras: ["event", "highlights", "secondaryCta"], align: "left", font: "brand", labels: { eyebrow: "Badge (e.g. You're invited)", highlights: "What to expect" } },
  { id: "holiday", name: "Seasonal greeting", description: "Elegant, centred greeting for holidays and milestones.", icon: "✺", category: "events", extras: ["offer", "secondaryCta"], align: "center", font: "elegant", labels: { eyebrow: "Small line above the greeting" } },
  { id: "service", name: "Service spotlight", description: "Clean service menu for salons, agencies and studios.", icon: "◉", category: "industry", extras: ["items", "highlights", "secondaryCta"], align: "left", font: "brand", labels: { highlights: "Why choose us" } },
  { id: "hospitality", name: "Hotel / booking", description: "Property imagery, amenities and a booking button.", icon: "⌂", category: "industry", extras: ["items", "highlights", "offer", "secondaryCta"], align: "left", font: "brand", labels: { highlights: "Amenities", offerLabel: "Special rate", offerNote: "Rate details" } },
  { id: "restaurant", name: "Menu special", description: "Menu-style list with prices for restaurants and cafés.", icon: "◍", category: "industry", extras: ["items", "highlights", "secondaryCta"], align: "center", font: "elegant", labels: { eyebrow: "Small line above the heading", highlights: "Good to know (hours, delivery…)" } },
];

const TEMPLATE_BY_ID = Object.fromEntries(MARKETING_TEMPLATES.map((t) => [t.id, t])) as Record<MarketingTemplateId, MarketingTemplateMeta>;

/**
 * Rule-based template curation. This intentionally uses no AI: the connected
 * website's verified businessType plus the scanned catalog shape determine
 * which designs are surfaced first. Legacy templates remain registered so
 * previously sent campaigns can still be rendered, but the composer only
 * exposes the curated set below.
 */
export type CuratedTemplateRecommendation = MarketingTemplateMeta & { reason: string; score: number };

const CURATED_TEMPLATE_IDS: MarketingTemplateId[] = [
  // The generated/reference-quality designs are the customer-facing gallery.
  // Legacy templates remain registered so historical campaigns can render.
  "ref_dark_menu",
  "ref_food_catalog",
  "ref_restaurant",
  "ref_offer",
  "ref_editorial",
  "ref_thankyou",
  "ref_confirmation",
  "ref_pricing",
  "ref_hotel",
  "ref_journey",
  "ref_catalog",
  "ref_product_launch",
];

function curationIndustry(brand: MarketingBrand, items: MarketingItem[]) {
  const type = `${brand.businessType ?? ""} ${brand.businessDescription ?? ""}`.toLowerCase();
  const catalog = items.map((i) => `${i.kind ?? ""} ${i.name} ${i.description ?? ""}`).join(" ").toLowerCase();
  return {
    hotel: /hotel|resort|lodge|hospitality|guest house|accommodation/.test(type),
    restaurant: /restaurant|cafe|café|bakery|bar|catering|food|dining/.test(type) || /menu|dish|breakfast|lunch|dinner/.test(catalog),
    ecommerce: /e-?commerce|shop|retail|store|fashion|beauty products|electronics/.test(type) || items.some(i => i.kind === "product"),
    service: /agency|consult|studio|photography|professional|law|accounting|real estate|salon|barber|spa|beauty|service/.test(type) || items.some(i => i.kind === "service"),
  };
}

export function curateMarketingTemplates(brand: MarketingBrand, items: MarketingItem[]): CuratedTemplateRecommendation[] {
  const ind = curationIndustry(brand, items);
  const score: Record<MarketingTemplateId, number> = Object.fromEntries(CURATED_TEMPLATE_IDS.map(id => [id, 0])) as Record<MarketingTemplateId, number>;
  const reason: Partial<Record<MarketingTemplateId, string>> = {};

  const add = (id: MarketingTemplateId, points: number, why: string) => {
    score[id] += points;
    if (!reason[id] || points > 5) reason[id] = why;
  };

  // Deterministic curation: only verified website type/description and the
  // scanned catalog shape are used. No AI/model call is made.
  if (ind.hotel) {
    add("ref_hotel", 120, "Built for hotels with rooms, amenities and booking-focused storytelling.");
    add("ref_catalog", 112, "Fits accommodation brands that want to showcase rooms and experiences.");
    add("ref_offer", 104, "Useful for room-rate offers, weekend deals and limited promotions.");
    add("ref_journey", 92, "Works for destination stories, guest tips and travel experiences.");
    add("ref_confirmation", 84, "Useful for booking confirmations and guest next steps.");
    add("ref_thankyou", 76, "Fits post-booking and guest appreciation messages.");
  } else if (ind.restaurant) {
    add("ref_dark_menu", 120, "Designed around food-led menus, featured dishes and reservations.");
    add("ref_food_catalog", 114, "Fits restaurants and cafés with a scannable menu or product catalog.");
    add("ref_restaurant", 108, "Built for featured dishes, dining stories and menu campaigns.");
    add("ref_offer", 96, "Useful for dining promotions, percentage offers and special events.");
    add("ref_editorial", 82, "Works for chef stories, restaurant news and experience-led campaigns.");
    add("ref_thankyou", 70, "Useful for reservation, order and customer appreciation follow-ups.");
  } else if (ind.ecommerce) {
    add("ref_product_launch", 120, "Built for product launches with a strong hero, benefits and CTA.");
    add("ref_offer", 114, "Fits product promotions, discounts and limited-time campaigns.");
    add("ref_catalog", 108, "Works for collections and curated product selections.");
    add("ref_editorial", 94, "Useful for product stories, brand storytelling and featured collections.");
    add("ref_pricing", 84, "Useful when presenting pricing, options and value clearly.");
    add("ref_thankyou", 72, "Fits post-purchase appreciation and what-happens-next messages.");
  } else if (ind.service) {
    add("ref_editorial", 120, "Designed for professional services, agencies, studios and consultants.");
    add("ref_editorial", 112, "Fits service stories, case-study-style content and expertise-led updates.");
    add("ref_pricing", 102, "Useful for packages, pricing updates and clear service options.");
    add("ref_catalog", 92, "Works for presenting a service portfolio or selected offerings.");
    add("ref_product_launch", 82, "Useful for announcing a new service, package or capability.");
    add("ref_thankyou", 72, "Fits client follow-ups, appreciation and next-step messages.");
  } else {
    add("ref_editorial", 110, "A flexible editorial design for general business storytelling.");
    add("ref_catalog", 104, "A flexible way to showcase products, services or selected offerings.");
    add("ref_offer", 98, "Useful for promotions and customer-facing campaigns.");
    add("ref_product_launch", 90, "Useful for launches, announcements and new offerings.");
    add("ref_pricing", 82, "Useful for clear pricing, packages and value communication.");
    add("ref_thankyou", 74, "Useful for customer appreciation and follow-up messages.");
  }

  return CURATED_TEMPLATE_IDS
    .map(id => ({ ...TEMPLATE_BY_ID[id], score: score[id], reason: reason[id] ?? "Matched to your connected website profile." }))
    .sort((a, b) => b.score - a.score);
}

export function getCuratedMarketingTemplates(brand: MarketingBrand, items: MarketingItem[]): MarketingTemplateMeta[] {
  return curateMarketingTemplates(brand, items);
}

export function getMarketingTemplate(id: string): MarketingTemplateMeta {
  return TEMPLATE_BY_ID[id as MarketingTemplateId] ?? TEMPLATE_BY_ID.announcement;
}

export function marketingTemplateName(id: string) {
  return TEMPLATE_BY_ID[id as MarketingTemplateId]?.name ?? id;
}

export const MARKETING_FONT_OPTIONS: Array<{ id: MarketingFontKey; label: string; stack?: string }> = [
  { id: "brand", label: "My brand font" },
  { id: "sans", label: "Clean sans", stack: "Arial, Helvetica, sans-serif" },
  { id: "modern", label: "Modern", stack: "'Helvetica Neue', Helvetica, Arial, sans-serif" },
  { id: "rounded", label: "Friendly", stack: "'Trebuchet MS', Verdana, Geneva, sans-serif" },
  { id: "serif", label: "Classic serif", stack: "Georgia, 'Times New Roman', Times, serif" },
  { id: "elegant", label: "Elegant serif", stack: "'Palatino Linotype', 'Book Antiqua', Palatino, Georgia, serif" },
];

/* -------------------------------------------------------------------------- */
/*  Limits + normalisation (shared by the editor, the server action, the sender) */
/* -------------------------------------------------------------------------- */

export const MARKETING_LIMITS = {
  subject: 180,
  previewText: 180,
  eyebrow: 60,
  headline: 150,
  body: 2000,
  ctaLabel: 40,
  ctaUrl: 2000,
  imageUrl: 2000,
  secondaryCtaLabel: 40,
  secondaryCtaUrl: 2000,
  offerLabel: 40,
  couponCode: 40,
  offerNote: 120,
  eventDate: 80,
  eventTime: 60,
  eventLocation: 160,
  signature: 200,
  closingNote: 400,
  highlight: 120,
  highlights: 6,
  items: 6,
  itemName: 120,
  itemDescription: 300,
  itemPrice: 40,
  itemUrl: 2000,
} as const;

const LIMIT_LABELS: Record<string, string> = {
  subject: "Subject",
  previewText: "Preview text",
  eyebrow: "Eyebrow",
  headline: "Headline",
  body: "Message",
  ctaLabel: "Button label",
  ctaUrl: "Button URL",
  imageUrl: "Hero image URL",
  secondaryCtaLabel: "Second link label",
  secondaryCtaUrl: "Second link URL",
  offerLabel: "Offer",
  couponCode: "Discount code",
  offerNote: "Offer note",
  eventDate: "Event date",
  eventTime: "Event time",
  eventLocation: "Event location",
  signature: "Sign-off",
  closingNote: "P.S. note",
};

const HEX_RE = /^#(?:[0-9a-f]{3}|[0-9a-f]{6})$/i;
const FONT_KEYS = MARKETING_FONT_OPTIONS.map((f) => f.id) as string[];

function cleanHex(value: unknown): string | undefined {
  return typeof value === "string" && HEX_RE.test(value.trim()) ? value.trim() : undefined;
}

function str(value: unknown, max: number): string {
  return typeof value === "string" ? value.trim().slice(0, max) : "";
}

function optStr(value: unknown, max: number): string | undefined {
  const v = str(value, max);
  return v || undefined;
}

function asRecord(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" && !Array.isArray(value) ? (value as Record<string, unknown>) : {};
}

function normalizeStyle(raw: unknown): MarketingStyle | undefined {
  const r = asRecord(raw);
  const out: MarketingStyle = {};
  for (const key of ["primary", "button", "background", "text"] as const) {
    const hex = cleanHex(r[key]);
    if (hex) out[key] = hex;
  }
  if (typeof r.font === "string" && FONT_KEYS.includes(r.font)) out.font = r.font as MarketingFontKey;
  if (r.buttonShape === "rounded" || r.buttonShape === "pill" || r.buttonShape === "square") out.buttonShape = r.buttonShape;
  if (r.align === "left" || r.align === "center") out.align = r.align;
  for (const key of ["showLogo", "showImage", "showItems", "showFooterDetails"] as const) {
    if (typeof r[key] === "boolean") out[key] = r[key] as boolean;
  }
  return Object.keys(out).length ? out : undefined;
}

/** Clamp and sanitise whatever the client sent. Safe to call on already-clean content. */
export function normalizeMarketingContent(raw: unknown): MarketingContent {
  const r = asRecord(raw);
  const L = MARKETING_LIMITS;
  const items: MarketingItem[] = (Array.isArray(r.items) ? r.items : [])
    .map((entry) => asRecord(entry))
    .filter((entry) => typeof entry.name === "string" && entry.name.trim())
    .slice(0, L.items)
    .map((entry) => ({
      kind: entry.kind === "product" || entry.kind === "service" ? entry.kind : undefined,
      name: str(entry.name, L.itemName),
      description: optStr(entry.description, L.itemDescription) ?? null,
      price: optStr(entry.price, L.itemPrice) ?? null,
      imageUrl: optStr(entry.imageUrl, L.imageUrl) ?? null,
      href: optStr(entry.href, L.itemUrl) ?? null,
    }));
  const highlights = (Array.isArray(r.highlights) ? r.highlights : [])
    .map((h) => str(h, L.highlight))
    .filter(Boolean)
    .slice(0, L.highlights);

  return {
    eyebrow: str(r.eyebrow, L.eyebrow),
    headline: str(r.headline, L.headline),
    body: str(r.body, L.body),
    ctaLabel: str(r.ctaLabel, L.ctaLabel),
    ctaUrl: str(r.ctaUrl, L.ctaUrl),
    imageUrl: optStr(r.imageUrl, L.imageUrl) ?? null,
    items,
    previewText: optStr(r.previewText, L.previewText),
    secondaryCtaLabel: optStr(r.secondaryCtaLabel, L.secondaryCtaLabel),
    secondaryCtaUrl: optStr(r.secondaryCtaUrl, L.secondaryCtaUrl),
    highlights: highlights.length ? highlights : undefined,
    offerLabel: optStr(r.offerLabel, L.offerLabel),
    couponCode: optStr(r.couponCode, L.couponCode),
    offerNote: optStr(r.offerNote, L.offerNote),
    eventDate: optStr(r.eventDate, L.eventDate),
    eventTime: optStr(r.eventTime, L.eventTime),
    eventLocation: optStr(r.eventLocation, L.eventLocation),
    signature: optStr(r.signature, L.signature),
    closingNote: optStr(r.closingNote, L.closingNote),
    style: normalizeStyle(r.style),
  };
}

/** Name of the first field that exceeds its limit (untrimmed input), or null. */
export function marketingOverLimit(input: unknown): string | null {
  const r = asRecord(input);
  const L = MARKETING_LIMITS as Record<string, number>;
  for (const key of Object.keys(LIMIT_LABELS)) {
    const v = r[key];
    if (typeof v === "string" && v.trim().length > L[key]) return LIMIT_LABELS[key];
  }
  if (Array.isArray(r.highlights)) {
    if (r.highlights.length > L.highlights) return "Highlights";
    if (r.highlights.some((h) => typeof h === "string" && h.trim().length > L.highlight)) return "Highlight";
  }
  if (Array.isArray(r.items)) {
    if (r.items.length > L.items) return "Featured items";
    for (const entry of r.items) {
      const e = asRecord(entry);
      if (typeof e.name === "string" && e.name.trim().length > L.itemName) return "Item name";
      if (typeof e.description === "string" && e.description.trim().length > L.itemDescription) return "Item description";
      if (typeof e.price === "string" && e.price.trim().length > L.itemPrice) return "Item price";
    }
  }
  return null;
}

/* -------------------------------------------------------------------------- */
/*  Small helpers                                                              */
/* -------------------------------------------------------------------------- */

function esc(value: unknown) {
  return String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

/** Escape, then keep the author's line breaks. */
function escBr(value: unknown) {
  return esc(value).replace(/\r?\n/g, "<br>");
}

function safeUrl(value: string | undefined | null, fallback = APP_URL) {
  const raw = String(value ?? "").trim();
  if (!raw) return fallback;
  try {
    const u = new URL(raw, APP_URL);
    if (["http:", "https:"].includes(u.protocol)) return u.toString();
  } catch {}
  return fallback;
}

function firstHex(value: string | undefined, fallback: string) {
  return /^#[0-9a-f]{3,8}$/i.test(value ?? "") ? value! : fallback;
}

function rgb(hex: string): [number, number, number] {
  let h = hex.replace("#", "");
  if (h.length === 3 || h.length === 4) h = h.split("").map((x) => x + x).join("");
  const n = Number.parseInt(h.slice(0, 6).padEnd(6, "0"), 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}

function toHex([r, g, b]: [number, number, number]) {
  return "#" + [r, g, b].map((v) => Math.max(0, Math.min(255, Math.round(v))).toString(16).padStart(2, "0")).join("");
}

/** Blend a toward b; t = how much of b (0..1). */
function mix(a: string, b: string, t: number) {
  const x = rgb(a);
  const y = rgb(b);
  return toHex([x[0] + (y[0] - x[0]) * t, x[1] + (y[1] - x[1]) * t, x[2] + (y[2] - x[2]) * t]);
}

function lum255(hex: string) {
  const [r, g, b] = rgb(hex);
  return 0.299 * r + 0.587 * g + 0.114 * b;
}

function readableOn(hex: string) {
  return lum255(hex) > 160 ? "#111827" : "#ffffff";
}

function fontStack(key: MarketingFontKey, brand: MarketingBrand) {
  const found = MARKETING_FONT_OPTIONS.find((f) => f.id === key);
  if (found?.stack) return found.stack;
  const family = String(brand.fontFamily || "Arial").replace(/[^\w\s,'"-]/g, "");
  return `${family},Arial,Helvetica,sans-serif`;
}

/* -------------------------------------------------------------------------- */
/*  Render context + building blocks                                           */
/* -------------------------------------------------------------------------- */

type Ctx = {
  brand: MarketingBrand;
  c: MarketingContent;
  meta: MarketingTemplateMeta;
  p: string; // brand colour (decorative)
  pt: string; // brand colour that is safe to use as text on white
  a: string; // button colour on light backgrounds
  acc: string; // accent that is safe on dark backgrounds
  tx: string;
  sec: string;
  dark: string;
  onP: string;
  muted: string;
  soft: string;
  line: string;
  align: MarketingAlign;
  radius: number;
  imgRadius: number;
  font: string;
  greeting: string;
  image: string | null;
  items: MarketingItem[];
};

function buildCtx(template: MarketingTemplateId, brand: MarketingBrand, c: MarketingContent, recipientFirstName?: string): Ctx {
  const meta = getMarketingTemplate(template);
  const s = c.style ?? {};
  const p = s.primary ?? firstHex(brand.primary, "#111827");
  const sec = firstHex(brand.secondary, "#111827");
  const accRaw = firstHex(brand.accent, p);
  let tx = s.text ?? firstHex(brand.text, "#111827");
  if (lum255(tx) > 150) tx = "#111827"; // the email card is white; never put light text on it
  const shape = s.buttonShape ?? "rounded";
  return {
    brand,
    c,
    meta,
    p,
    pt: lum255(p) > 200 ? mix(p, "#000000", 0.55) : p,
    a: s.button ?? p,
    acc: s.button ?? (lum255(accRaw) > 90 ? accRaw : mix(accRaw, "#ffffff", 0.55)),
    tx,
    sec,
    dark: lum255(sec) < 90 ? sec : "#0f172a",
    onP: readableOn(p),
    muted: mix(tx, "#ffffff", 0.36),
    soft: mix(p, "#ffffff", 0.9),
    line: mix(tx, "#ffffff", 0.86),
    align: s.align ?? meta.align,
    radius: shape === "pill" ? 999 : shape === "square" ? 0 : 10,
    imgRadius: shape === "square" ? 0 : 12,
    font: fontStack(s.font ?? meta.font, brand),
    greeting: recipientFirstName ? `Hi ${esc(recipientFirstName)},` : "Hello,",
    image: s.showImage === false ? null : c.imageUrl || null,
    items: s.showItems === false ? [] : c.items,
  };
}

const storeUrl = (x: Ctx) => `${APP_URL}/${x.brand.slug}`;

function caps(x: Ctx, text: string, color: string, mb = 10) {
  if (!text) return "";
  return `<div style="margin:0 0 ${mb}px;font-size:11px;font-weight:800;letter-spacing:2px;text-transform:uppercase;color:${color};">${esc(text)}</div>`;
}

function plainEyebrow(x: Ctx, text: string, color = x.pt, align: MarketingAlign = x.align, mb = 8) {
  if (!text) return "";
  return `<div style="margin:0 0 ${mb}px;font-size:14px;font-weight:700;color:${color};text-align:${align};">${esc(text)}</div>`;
}

function pill(text: string, bg: string, fg: string) {
  if (!text) return "";
  return `<span style="display:inline-block;background:${bg};color:${fg};font-size:12px;font-weight:800;line-height:14px;padding:7px 14px;border-radius:999px;">${esc(text)}</span>`;
}

function h1(x: Ctx, text: string, o: { size?: number; color?: string; align?: MarketingAlign; mb?: number; ls?: string } = {}) {
  if (!text) return "";
  return `<h1 class="h1" style="margin:0 0 ${o.mb ?? 12}px;font-size:${o.size ?? 32}px;line-height:1.12;letter-spacing:${o.ls ?? "-0.5px"};font-weight:800;color:${o.color ?? x.tx};text-align:${o.align ?? x.align};">${esc(text)}</h1>`;
}

function para(x: Ctx, text: string, o: { size?: number; color?: string; align?: MarketingAlign; lh?: number; mb?: number } = {}) {
  if (!text) return "";
  const size = o.size ?? 15;
  return text
    .split(/\n{2,}/)
    .map((chunk) => chunk.trim())
    .filter(Boolean)
    .map((chunk) => `<p style="margin:0 0 ${o.mb ?? 14}px;font-size:${size}px;line-height:${o.lh ?? Math.round(size * 1.65)}px;color:${o.color ?? x.muted};text-align:${o.align ?? x.align};">${escBr(chunk)}</p>`)
    .join("");
}

function img(x: Ctx, src: string, alt: string, width: number, radius = x.imgRadius) {
  return `<img src="${safeUrl(src)}" alt="${esc(alt)}" width="${width}" style="display:block;width:100%;max-width:${width}px;height:auto;border:0;outline:none;text-decoration:none;border-radius:${radius}px;" />`;
}

function fullBleed(x: Ctx, alt: string) {
  return x.image ? `<img src="${safeUrl(x.image)}" alt="${esc(alt)}" width="640" style="display:block;width:100%;height:auto;border:0;outline:none;" />` : "";
}

function btn(x: Ctx, label: string, url: string, o: { bg?: string; fg?: string; outline?: boolean; block?: boolean; align?: MarketingAlign } = {}) {
  if (!label) return "";
  const bg = o.bg ?? x.a;
  const align = o.align ?? x.align;
  const link = `display:${o.block ? "block" : "inline-block"};padding:${o.outline ? 12 : 14}px 26px;font-size:15px;font-weight:700;text-decoration:none;text-align:center;`;
  const cell = o.outline
    ? `<td style="border-radius:${x.radius}px;border:2px solid ${bg};"><a href="${safeUrl(url, storeUrl(x))}" style="${link}color:${bg};">${esc(label)}</a></td>`
    : `<td bgcolor="${bg}" style="border-radius:${x.radius}px;background:${bg};"><a href="${safeUrl(url, storeUrl(x))}" style="${link}color:${o.fg ?? readableOn(bg)};">${esc(label)}</a></td>`;
  return `<table role="presentation" cellspacing="0" cellpadding="0" border="0"${align === "center" ? ' align="center"' : ""}${o.block ? ' width="100%"' : ""}><tr>${cell}</tr></table>`;
}

/** Main button plus the optional second text link. */
function ctas(x: Ctx, o: { bg?: string; fg?: string; outline?: boolean; block?: boolean; linkColor?: string; align?: MarketingAlign } = {}) {
  const { c } = x;
  const align = o.align ?? x.align;
  const main = btn(x, c.ctaLabel, c.ctaUrl, { ...o, align });
  const second = c.secondaryCtaLabel
    ? `<a href="${safeUrl(c.secondaryCtaUrl, storeUrl(x))}" style="color:${o.linkColor ?? x.pt};font-size:14px;font-weight:700;text-decoration:underline;">${esc(c.secondaryCtaLabel)}</a>`
    : "";
  if (!main && !second) return "";
  if (!second) return main;
  if (!main) return `<div style="text-align:${align};">${second}</div>`;
  if (align === "center" || o.block) return `${main}<div style="margin-top:16px;text-align:${align};">${second}</div>`;
  return `<table role="presentation" cellspacing="0" cellpadding="0" border="0"><tr><td>${main}</td><td style="padding-left:22px;">${second}</td></tr></table>`;
}

function checkList(x: Ctx, list: string[] | undefined, o: { color?: string; textColor?: string } = {}) {
  if (!list?.length) return "";
  const rows = list
    .map((t) => `<tr><td width="26" valign="top" style="padding:0 0 10px;font-size:15px;line-height:22px;font-weight:800;color:${o.color ?? x.pt};">&#10003;</td><td valign="top" style="padding:0 0 10px;font-size:15px;line-height:22px;color:${o.textColor ?? x.tx};text-align:left;">${esc(t)}</td></tr>`)
    .join("");
  return `<table role="presentation" cellspacing="0" cellpadding="0" border="0"${x.align === "center" ? ' align="center"' : ""} style="margin:4px 0 12px;">${rows}</table>`;
}

function sign(x: Ctx, o: { align?: MarketingAlign; color?: string } = {}) {
  const { c } = x;
  const align = o.align ?? x.align;
  return `${c.signature ? `<p style="margin:26px 0 0;font-size:15px;line-height:24px;color:${o.color ?? x.tx};text-align:${align};">${escBr(c.signature)}</p>` : ""}${c.closingNote ? `<p style="margin:18px 0 0;font-size:13px;line-height:20px;color:${x.muted};text-align:${align};">${escBr(c.closingNote)}</p>` : ""}`;
}

function codeBox(x: Ctx, o: { color?: string; textColor?: string; bg?: string; align?: MarketingAlign } = {}) {
  const code = x.c.couponCode;
  if (!code) return "";
  const color = o.color ?? x.pt;
  const align = o.align ?? x.align;
  return `<table role="presentation" cellspacing="0" cellpadding="0" border="0"${align === "center" ? ' align="center"' : ""} style="margin:0 0 18px;"><tr><td style="border:2px dashed ${color};border-radius:10px;padding:12px 26px;text-align:center;background:${o.bg ?? "transparent"};"><div style="font-size:12px;line-height:16px;color:${o.textColor ?? x.muted};">Use code at checkout</div><div style="margin-top:4px;font-family:'Courier New',Courier,monospace;font-size:24px;line-height:28px;font-weight:800;letter-spacing:4px;color:${color};">${esc(code)}</div></td></tr></table>`;
}

function itemPlaceholder(x: Ctx, name: string, height: number, width: number) {
  return `<div style="width:100%;max-width:${width}px;height:${height}px;line-height:${height}px;background:${x.soft};border-radius:${x.imgRadius}px;text-align:center;font-size:34px;font-weight:800;color:${x.pt};">${esc(name.slice(0, 1).toUpperCase())}</div>`;
}

function itemCard(x: Ctx, item: MarketingItem, width: number, anyImage: boolean) {
  const media = item.imageUrl ? img(x, item.imageUrl, item.name, width) : anyImage ? itemPlaceholder(x, item.name, Math.round(width * 0.66), width) : "";
  return `<a href="${safeUrl(item.href, storeUrl(x))}" style="display:block;text-decoration:none;color:${x.tx};">${media}<div style="padding-top:${media ? 10 : 0}px;font-size:15px;line-height:20px;font-weight:700;color:${x.tx};">${esc(item.name)}</div>${item.description ? `<div style="padding-top:4px;color:${x.muted};font-size:12px;line-height:18px;">${esc(item.description.slice(0, 140))}</div>` : ""}${item.price ? `<div style="padding-top:6px;color:${x.pt};font-size:14px;font-weight:800;">${esc(item.price)}</div>` : ""}</a>`;
}

function grid(x: Ctx, items: MarketingItem[], cols: 1 | 2 | 3 = 2) {
  if (!items.length) return "";
  const width = cols === 1 ? 572 : cols === 2 ? 278 : 184;
  const anyImage = items.some((i) => i.imageUrl);
  const rows: MarketingItem[][] = [];
  for (let i = 0; i < items.length; i += cols) rows.push(items.slice(i, i + cols));
  return `<table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0">${rows
    .map((row) => {
      const cells = row.map((item, idx) => `<td class="col" width="${Math.floor(100 / cols)}%" valign="top" style="padding:0 ${idx < cols - 1 ? 8 : 0}px 22px ${idx > 0 ? 8 : 0}px;text-align:left;">${itemCard(x, item, width, anyImage)}</td>`);
      while (cells.length < cols) cells.push(`<td class="col" width="${Math.floor(100 / cols)}%" style="padding:0;"></td>`);
      return `<tr>${cells.join("")}</tr>`;
    })
    .join("")}</table>`;
}

function thumbRows(x: Ctx, items: MarketingItem[]) {
  if (!items.length) return "";
  const anyImage = items.some((i) => i.imageUrl);
  return `<table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0">${items
    .map((item) => {
      const media = item.imageUrl ? img(x, item.imageUrl, item.name, 120) : anyImage ? itemPlaceholder(x, item.name, 90, 120) : "";
      return `<tr>${media ? `<td width="120" valign="top" style="padding:0 18px 20px 0;">${media}</td>` : ""}<td valign="top" style="padding:0 0 20px;text-align:left;"><a href="${safeUrl(item.href, storeUrl(x))}" style="text-decoration:none;color:${x.tx};"><div style="font-size:16px;line-height:22px;font-weight:700;color:${x.tx};">${esc(item.name)}</div>${item.description ? `<div style="padding-top:4px;color:${x.muted};font-size:13px;line-height:20px;">${esc(item.description.slice(0, 200))}</div>` : ""}<div style="padding-top:6px;font-size:13px;font-weight:700;color:${x.pt};">${item.price ? `${esc(item.price)} &nbsp;&middot;&nbsp; ` : ""}Read more</div></a></td></tr>`;
    })
    .join("")}</table>`;
}

function serviceList(x: Ctx, items: MarketingItem[]) {
  if (!items.length) return "";
  return `<div style="background:${x.soft};border-radius:${x.imgRadius + 2}px;padding:6px 20px;">${items
    .map(
      (item, i) => `<table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0"><tr><td style="padding:14px 0;${i < items.length - 1 ? `border-bottom:1px solid ${mix(x.p, "#ffffff", 0.8)};` : ""}text-align:left;"><table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0"><tr><td valign="top"><a href="${safeUrl(item.href, storeUrl(x))}" style="text-decoration:none;font-size:15px;line-height:20px;font-weight:700;color:${x.tx};">${esc(item.name)}</a></td>${item.price ? `<td valign="top" align="right" style="padding-left:12px;white-space:nowrap;font-size:14px;font-weight:800;color:${x.pt};">${esc(item.price)}</td>` : ""}</tr></table>${item.description ? `<div style="margin-top:4px;color:${x.muted};font-size:13px;line-height:19px;">${esc(item.description.slice(0, 180))}</div>` : ""}</td></tr></table>`
    )
    .join("")}</div>`;
}

function menuList(x: Ctx, items: MarketingItem[]) {
  if (!items.length) return "";
  return `<table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="text-align:left;">${items
    .map(
      (item) => `<tr><td valign="bottom" style="padding:14px 10px 0 0;white-space:nowrap;font-size:17px;line-height:22px;font-weight:700;color:${x.tx};">${esc(item.name)}</td><td valign="bottom" width="100%" style="padding-top:14px;"><div style="border-bottom:2px dotted ${mix(x.tx, "#ffffff", 0.7)};height:12px;line-height:12px;font-size:1px;">&nbsp;</div></td><td valign="bottom" style="padding:14px 0 0 10px;white-space:nowrap;font-size:16px;line-height:22px;font-weight:800;color:${x.pt};">${item.price ? esc(item.price) : ""}</td></tr>${item.description ? `<tr><td colspan="3" style="padding:3px 0 0;font-size:13px;line-height:19px;font-style:italic;color:${x.muted};">${esc(item.description.slice(0, 160))}</td></tr>` : ""}`
    )
    .join("")}</table>`;
}

function featureRows(x: Ctx, list: string[] | undefined, o: { color?: string; textColor?: string; lineColor?: string } = {}) {
  if (!list?.length) return "";
  return `<table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0">${list
    .map((t, i) => `<tr><td width="30" valign="top" style="padding:14px 0;${i < list.length - 1 ? `border-bottom:1px solid ${o.lineColor ?? x.line};` : ""}font-size:20px;line-height:24px;font-weight:800;color:${o.color ?? x.pt};">+</td><td valign="top" style="padding:14px 0;${i < list.length - 1 ? `border-bottom:1px solid ${o.lineColor ?? x.line};` : ""}font-size:16px;line-height:24px;font-weight:700;color:${o.textColor ?? x.tx};text-align:left;">${esc(t)}</td></tr>`)
    .join("")}</table>`;
}

function softCards(x: Ctx, list: string[] | undefined) {
  if (!list?.length) return "";
  return list
    .map((t) => `<table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="margin:0 0 10px;"><tr><td width="4" bgcolor="${x.p}" style="background:${x.p};border-radius:4px 0 0 4px;font-size:1px;line-height:1px;">&nbsp;</td><td bgcolor="${x.soft}" style="background:${x.soft};border-radius:0 ${x.imgRadius}px ${x.imgRadius}px 0;padding:14px 18px;font-size:15px;line-height:22px;font-weight:600;color:${x.tx};text-align:left;">${esc(t)}</td></tr></table>`)
    .join("");
}

function detailRow(x: Ctx, label: string, value: string | undefined, last = false) {
  if (!value) return "";
  return `<tr><td width="92" valign="top" style="padding:14px 0;${last ? "" : `border-bottom:1px solid ${mix(x.p, "#ffffff", 0.78)};`}font-size:13px;line-height:20px;color:${x.muted};">${label}</td><td valign="top" style="padding:14px 0;${last ? "" : `border-bottom:1px solid ${mix(x.p, "#ffffff", 0.78)};`}font-size:16px;line-height:22px;font-weight:700;color:${x.tx};text-align:left;">${esc(value)}</td></tr>`;
}

/* -------------------------------------------------------------------------- */
/*  The designs                                                                */
/* -------------------------------------------------------------------------- */

const pad = (inner: string, o: { top?: number; bottom?: number; bg?: string; align?: MarketingAlign } = {}) =>
  `<div class="pad" style="padding:${o.top ?? 34}px 34px ${o.bottom ?? 32}px;${o.bg ? `background:${o.bg};` : ""}${o.align ? `text-align:${o.align};` : ""}">${inner}</div>`;

const itemsBlock = (x: Ctx, html: string, top = 22) => (html ? `<div style="margin:${top}px 0 4px;">${html}</div>` : "");

function refHero(x: Ctx, eyebrow: string, headline: string, body: string, button: string, dark=false) {
  const bg = dark ? x.dark : x.p;
  const fg = readableOn(bg);
  return `<table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0"><tr><td style="background:${bg};padding:34px;text-align:${x.align};">${eyebrow ? `<div style="font-size:11px;letter-spacing:2.6px;text-transform:uppercase;font-weight:800;color:${fg};opacity:.82;margin-bottom:12px;">${esc(eyebrow)}</div>` : ""}${h1(x,headline,{size:40,color:fg,align:x.align,mb:14,ls:"-1px"})}${para(x,body,{size:15,color:fg,align:x.align,lh:24,mb:22})}${btn(x,button,x.c.ctaUrl,{bg:dark?x.acc:fg,fg:dark?readableOn(x.acc):readableOn(fg),align:x.align})}</td></tr></table>`;
}
function refCard(x: Ctx, item: MarketingItem, accent=x.p) {
  return `<table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="background:#fff;border:1px solid ${x.line};border-radius:12px;overflow:hidden;"><tr><td>${item.imageUrl?img(x,item.imageUrl,item.name,572,0):itemPlaceholder(x,item.name,190,572)}</td></tr><tr><td style="padding:15px 17px 18px;text-align:left;"><div style="font-size:15px;font-weight:800;color:${x.tx};">${esc(item.name)}</div>${item.description?`<div style="margin-top:5px;font-size:12px;line-height:18px;color:${x.muted};">${esc(item.description.slice(0,180))}</div>`:""}${item.price?`<div style="margin-top:8px;font-size:14px;font-weight:800;color:${accent};">${esc(item.price)}</div>`:""}</td></tr></table>`;
}
function refSectionTitle(x: Ctx, title: string, body="") { return `<div style="padding:28px 34px 12px;text-align:left;"><h2 style="margin:0;font-size:24px;line-height:29px;color:${x.tx};font-weight:800;letter-spacing:-.3px;">${esc(title)}</h2>${body?`<p style="margin:7px 0 0;font-size:13px;line-height:20px;color:${x.muted};">${esc(body)}</p>`:""}</div>`; }
function refTwoCol(x: Ctx, items: MarketingItem[]) { return grid(x,items.slice(0,4),2); }
function refSocialFooter(x: Ctx) { const links=Object.entries(x.brand.socialLinks??{}).filter(([,v])=>v).slice(0,5); return `<div style="padding:26px 34px;background:${mix(x.soft,"#ffffff",.35)};border-top:1px solid ${x.line};text-align:center;">${links.length?`<div style="margin-bottom:13px;">${links.map(([n,u])=>`<a href="${safeUrl(u)}" style="display:inline-block;margin:0 6px;color:${x.pt};font-size:11px;font-weight:800;text-decoration:none;">${esc(n)}</a>`).join("")}</div>`:""}<div style="font-size:11px;line-height:18px;color:${x.muted};">${esc(x.brand.name)}${x.brand.contactEmail?` · ${esc(x.brand.contactEmail)}`:""}${x.brand.contactPhone?` · ${esc(x.brand.contactPhone)}`:""}</div></div>`; }

function generatedBrandBar(x: Ctx, tagline?: string) {
  return `<div style="background:#fff;padding:24px 34px 18px;border-bottom:1px solid ${mix(x.pt,"#ffffff",.78)};">${x.brand.logoUrl?`<img src="${safeUrl(x.brand.logoUrl)}" alt="${esc(x.brand.name)}" height="44" style="display:block;max-width:190px;height:44px;width:auto;margin:0 0 8px;">`:`<div style="font-size:21px;line-height:25px;font-weight:900;letter-spacing:.4px;color:${x.pt};">${esc(x.brand.name)}</div>`}${tagline?`<div style="font-size:12px;line-height:18px;color:${x.muted};">${esc(tagline)}</div>`:""}</div>`;
}

function generatedFeatureStrip(x: Ctx, features: string[]) {
  const icons = ["⌂","✦","◇"];
  const list = features.slice(0,3);
  if (!list.length) return "";
  return `<table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="background:${x.dark};"><tr>${list.map((t,i)=>`<td width="${Math.floor(100/list.length)}%" valign="top" style="padding:24px 13px;text-align:center;${i<list.length-1?`border-right:1px solid ${mix(x.acc,x.dark,.35)};`:""}"><div style="font-size:23px;line-height:26px;color:${x.acc};margin-bottom:8px;">${icons[i]}</div><div style="font-size:11px;line-height:15px;font-weight:800;letter-spacing:1.5px;text-transform:uppercase;color:#fff;">${esc(t)}</div></td>`).join("")}</tr></table>`;
}

function generatedSplitHero(x: Ctx, o:{offer?:string; headline:string; body:string; button:string; image?:string|null}) {
  const image=o.image ?? x.image;
  const left=`<td width="50%" valign="middle" style="padding:38px 24px 34px 34px;background:${mix(x.soft,"#fff",.12)};text-align:left;"><div style="font-size:11px;letter-spacing:3px;text-transform:uppercase;font-weight:800;color:${x.pt};margin-bottom:12px;">${esc(x.c.eyebrow || "Special offer")}</div>${o.offer?`<div style="font-family:Georgia,serif;font-size:54px;line-height:56px;font-weight:800;color:${x.pt};margin-bottom:8px;">${esc(o.offer)}</div>`:""}${h1(x,o.headline,{size:o.offer?31:34,align:"left",mb:14,ls:"-1px"})}${para(x,o.body,{size:15,lh:24,align:"left",mb:20})}${btn(x,o.button,x.c.ctaUrl,{bg:x.dark,fg:"#fff",align:"left"})}</td>`;
  const right=image?`<td width="50%" valign="middle" style="padding:0;background:${x.soft};"><img src="${safeUrl(image)}" alt="${esc(o.headline)}" width="300" style="display:block;width:100%;max-width:300px;height:390px;object-fit:cover;border:0;">`:`<td width="50%" valign="middle" style="padding:30px;background:${x.soft};">${itemPlaceholder(x,o.headline,300,300)}`;
  return `<table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0"><tr>${left}${right}</td></tr></table>`;
}

function generatedSplitStory(x: Ctx, image?: string|null, title="A stay worth remembering", body=x.c.body) {
  const src=image ?? x.items.find(i=>i.imageUrl)?.imageUrl ?? x.image;
  return `<table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0"><tr>${src?`<td width="50%" valign="middle"><img src="${safeUrl(src)}" alt="${esc(title)}" width="300" style="display:block;width:100%;max-width:300px;height:280px;object-fit:cover;border:0;"></td>`:`<td width="50%" valign="middle" style="padding:20px;">${itemPlaceholder(x,title,240,280)}</td>`}<td width="50%" valign="middle" style="padding:30px 28px;background:#fff;text-align:left;"><div style="width:58px;height:2px;background:${x.pt};margin-bottom:18px;">&nbsp;</div>${h1(x,title,{size:28,align:"left",mb:12})}${para(x,body,{size:14,lh:22,align:"left",mb:18})}${btn(x,x.c.ctaLabel,x.c.ctaUrl,{bg:x.acc,fg:readableOn(x.acc),align:"left"})}</td></tr></table>`;
}

function generatedHotel(x: Ctx) {
  const c=x.c;
  return `${generatedBrandBar(x,"Luxury stays, unforgettable moments.")}${generatedSplitHero(x,{offer:c.offerLabel||"20% OFF",headline:c.headline||"Your next stay",body:c.body,button:c.ctaLabel||"Book now",image:c.imageUrl})}${generatedFeatureStrip(x,c.highlights?.slice(0,3)??["Luxury rooms","Fine dining","Spa & wellness"])}${generatedSplitStory(x,x.items.find(i=>i.imageUrl)?.imageUrl,x.items[0]?.name||"A stay worth remembering",c.body)}${refSocialFooter(x)}`;
}

function generatedRestaurant(x: Ctx) {
  const c=x.c; const hero=x.image;
  return `${generatedBrandBar(x,"Fresh flavours. Unforgettable experiences.")}${hero?`<img src="${safeUrl(hero)}" alt="${esc(c.headline)}" width="640" style="display:block;width:100%;height:320px;object-fit:cover;border:0;">`:""}<div style="background:${x.dark};padding:34px;text-align:left;">${caps(x,c.eyebrow,x.acc)}${h1(x,c.headline,{size:38,color:"#fff",align:"left",mb:12})}${para(x,c.body,{color:"#fff",align:"left",lh:24,mb:20})}${btn(x,c.ctaLabel,c.ctaUrl,{bg:x.acc,fg:readableOn(x.acc),align:"left"})}</div>${refSectionTitle(x,"Featured menu","A few favourites from the kitchen.")}${grid(x,x.items.slice(0,4),2)}${generatedFeatureStrip(x,c.highlights?.slice(0,3)??["Fresh ingredients","Thoughtful service","A memorable table"])}${refSocialFooter(x)}`;
}

function generatedCatalog(x: Ctx) {
  const c=x.c;
  return `${generatedBrandBar(x,"Curated for you.")}${refSectionTitle(x,c.headline||"Discover what’s new",c.body)}${x.image?`<div style="padding:0 34px 24px;">${img(x,x.image,c.headline,572,0)}</div>`:""}${grid(x,x.items.slice(0,6),2)}${c.highlights?.length?pad(featureRows(x,c.highlights,{color:x.pt}),{top:6,bottom:18}):""}${refSocialFooter(x)}`;
}

function generatedEditorial(x: Ctx) {
  const c=x.c;
  return `${generatedBrandBar(x,"The journal")}${pad(`${caps(x,c.eyebrow,x.pt)}${h1(x,c.headline,{size:42,align:"left",ls:"-1.2px",mb:16})}${x.image?`<div style="margin:0 0 24px;">${img(x,x.image,c.headline,572,0)}</div>`:""}${para(x,c.body,{size:16,lh:27,align:"left",mb:22})}${c.highlights?.length?softCards(x,c.highlights):""}`,{top:34,bottom:18,align:"left"})}${x.items.length?refSectionTitle(x,"Explore the collection"):""}${grid(x,x.items.slice(0,4),2)}${refSocialFooter(x)}`;
}

function generatedConfirmation(x: Ctx) {
  const c=x.c; const steps=(c.highlights??[]).slice(0,3);
  return `${generatedBrandBar(x,"Thank you for choosing us.")}${pad(`${caps(x,c.eyebrow,x.pt)}${h1(x,c.headline,{size:36,align:"center"})}${para(x,c.body,{align:"center",mb:20})}${steps.length?steps.map((t,i)=>`<div style="padding:15px 18px;background:${i%2?x.soft:"#fff"};border-top:1px solid ${x.line};text-align:left;"><span style="display:inline-block;width:28px;height:28px;line-height:28px;border-radius:50%;background:${x.pt};color:${readableOn(x.pt)};text-align:center;font-size:12px;font-weight:900;margin-right:10px;">${i+1}</span><span style="font-size:14px;font-weight:700;color:${x.tx};">${esc(t)}</span></div>`).join(""):""}${x.image?`<div style="margin-top:22px;">${img(x,x.image,c.headline,572,0)}</div>`:""}${ctas(x)}`,{top:34,bottom:24,align:"center"})}${refSocialFooter(x)}`;
}

function generatedDarkMenu(x: Ctx) {
  const c=x.c;
  return `${generatedBrandBar(x,"Made for the moment.")}${pad(`${caps(x,c.eyebrow,x.acc)}${h1(x,c.headline,{size:40,color:"#fff",align:"left",mb:12})}${para(x,c.body,{color:"#fff",align:"left",mb:22})}${ctas(x,{bg:x.acc,fg:readableOn(x.acc),align:"left"})}`,{top:36,bottom:30,bg:x.dark,align:"left"})}<div style="background:${x.dark};padding:0 28px 28px;">${menuList({...x,tx:"#fff",muted:mix("#fff",x.dark,.45)} as Ctx,x.items.slice(0,9))}</div>${generatedFeatureStrip(x,c.highlights??["Fresh today","Easy to order","Reserve online"])}${refSocialFooter(x)}`;
}

const RENDERERS: Record<MarketingTemplateId, (x: Ctx) => string> = {
  announcement(x) {
    const { c } = x;
    return `${fullBleed(x, c.headline)}${pad(
      `${caps(x, c.eyebrow, x.pt)}${h1(x, c.headline, { size: 34 })}<p style="margin:0 0 12px;font-size:15px;line-height:25px;color:${x.tx};text-align:${x.align};">${x.greeting}</p>${para(x, c.body)}${checkList(x, c.highlights)}${itemsBlock(x, grid(x, x.items, 2))}<div style="margin-top:22px;">${ctas(x)}</div>${sign(x)}`,
      { align: x.align }
    )}`;
  },

  launch(x) {
    const { c } = x;
    const D = x.dark;
    const acc = x.acc;
    return `${pad(
      `<div style="margin-bottom:20px;text-align:${x.align};">${pill(c.eyebrow, acc, readableOn(acc))}</div>${h1(x, c.headline, { size: 42, color: "#ffffff", mb: 16, ls: "-1.2px" })}${para(x, c.body, { size: 16, color: mix("#ffffff", D, 0.28), mb: 22 })}${ctas(x, { bg: acc, linkColor: "#ffffff" })}`,
      { top: 44, bottom: x.image ? 34 : 40, bg: D, align: x.align }
    )}${x.image ? `<div style="background:${D};padding:0 34px;"><img src="${safeUrl(x.image)}" alt="${esc(c.headline)}" width="572" style="display:block;width:100%;max-width:572px;height:auto;border:0;border-radius:${x.imgRadius}px ${x.imgRadius}px 0 0;" /></div>` : ""}${
      c.highlights?.length || x.items.length || c.signature || c.closingNote
        ? pad(`${featureRows(x, c.highlights)}${itemsBlock(x, grid(x, x.items, 2), 26)}${sign(x)}`, { top: 22, bottom: 26, align: x.align })
        : ""
    }`;
  },

  showcase(x) {
    const { c } = x;
    return pad(
      `${plainEyebrow(x, c.eyebrow, x.pt, "left")}${h1(x, c.headline, { size: 32, align: "left" })}${para(x, c.body, { align: "left", mb: 22 })}${x.image ? `<div style="margin-bottom:26px;">${img(x, x.image, c.headline, 572)}</div>` : ""}${grid(x, x.items, 2)}<div style="margin-top:6px;">${ctas(x, { align: "left" })}</div>${sign(x, { align: "left" })}`,
      { align: "left" }
    );
  },

  newsletter(x) {
    const { c } = x;
    return `${pad(
      `<table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0"><tr><td style="font-size:20px;line-height:24px;font-weight:800;letter-spacing:-0.3px;color:${x.tx};text-align:left;">${esc(x.brand.name)}</td><td align="right" style="font-size:13px;line-height:20px;color:${x.muted};">${esc(c.eyebrow)}</td></tr></table><div style="height:3px;line-height:3px;font-size:1px;background:${x.p};margin:14px 0 26px;">&nbsp;</div>${x.image ? `<div style="margin-bottom:24px;">${img(x, x.image, c.headline, 572)}</div>` : ""}${h1(x, c.headline, { size: 30, align: "left", mb: 14 })}<p style="margin:0 0 10px;font-size:15px;line-height:25px;color:${x.tx};text-align:left;">${x.greeting}</p>${para(x, c.body, { align: "left", mb: 18 })}${
        c.highlights?.length
          ? `<table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="margin:6px 0 20px;">${c.highlights.map((t) => `<tr><td width="18" valign="top" style="padding:0 0 8px;font-size:15px;line-height:22px;font-weight:800;color:${x.pt};">&bull;</td><td valign="top" style="padding:0 0 8px;font-size:15px;line-height:22px;color:${x.tx};text-align:left;">${esc(t)}</td></tr>`).join("")}</table>`
          : ""
      }${x.items.length ? `<div style="border-top:1px solid ${x.line};padding-top:24px;margin-top:6px;">${thumbRows(x, x.items)}</div>` : ""}<div style="margin-top:6px;">${ctas(x, { align: "left" })}</div>${sign(x, { align: "left" })}`,
      { top: 30, align: "left" }
    )}`;
  },

  promotion(x) {
    const { c } = x;
    const same = x.acc.toLowerCase() === x.p.toLowerCase();
    const bg = same ? "#ffffff" : x.acc;
    const fg = same ? x.p : readableOn(bg);
    return `${pad(
      `${x.image ? `<div style="margin-bottom:26px;">${img(x, x.image, c.headline, 572)}</div>` : ""}<div style="font-size:14px;font-weight:700;color:${x.onP};opacity:.85;margin-bottom:8px;">${esc(c.eyebrow)}</div>${c.offerLabel ? `<div style="font-size:58px;line-height:60px;font-weight:900;letter-spacing:-2px;color:${x.onP};margin:0 0 10px;">${esc(c.offerLabel)}</div>` : ""}${h1(x, c.headline, { size: c.offerLabel ? 26 : 34, color: x.onP, align: "center", mb: 12 })}${para(x, c.body, { color: x.onP, align: "center", mb: 22 })}${c.couponCode ? codeBox(x, { color: x.onP, textColor: x.onP, align: "center" }) : ""}${c.offerNote ? `<p style="margin:0 0 20px;font-size:13px;color:${x.onP};opacity:.8;text-align:center;">${esc(c.offerNote)}</p>` : ""}${ctas(x, { bg, fg, linkColor: x.onP, align: "center" })}`,
      { top: 34, bottom: 34, bg: x.p, align: "center" }
    )}${x.items.length || c.signature || c.closingNote ? pad(`${grid(x, x.items, 2)}${sign(x)}`, { top: 28, bottom: 18, align: x.align }) : ""}`;
  },

  flash(x) {
    const { c } = x;
    const D = x.dark;
    const acc = x.acc;
    return `${pad(
      `<div style="margin-bottom:18px;">${pill(c.eyebrow, acc, readableOn(acc))}</div>${c.offerLabel ? `<div style="font-size:76px;line-height:76px;font-weight:900;letter-spacing:-3px;color:${acc};margin:0 0 8px;">${esc(c.offerLabel)}</div>` : ""}${h1(x, c.headline, { size: 28, color: "#ffffff", align: "center", mb: 12 })}${para(x, c.body, { color: mix("#ffffff", D, 0.28), align: "center", mb: 22 })}${c.offerNote ? `<table role="presentation" cellspacing="0" cellpadding="0" border="0" align="center" style="margin:0 auto 22px;"><tr><td style="border:1px solid ${mix(acc, D, 0.4)};border-radius:999px;padding:9px 20px;font-size:13px;font-weight:700;color:#ffffff;">${esc(c.offerNote)}</td></tr></table>` : ""}${c.couponCode ? codeBox(x, { color: acc, textColor: mix("#ffffff", D, 0.3), align: "center" }) : ""}${btn(x, c.ctaLabel, c.ctaUrl, { bg: acc, block: true, align: "center" })}`,
      { top: 40, bottom: 40, bg: D, align: "center" }
    )}${x.image ? fullBleed(x, c.headline) : ""}${x.items.length || c.signature || c.closingNote ? pad(`${grid(x, x.items, 2)}${sign(x)}`, { top: 28, bottom: 18, align: x.align }) : ""}`;
  },

  coupon(x) {
    const { c } = x;
    return pad(
      `${x.image ? `<div style="margin-bottom:26px;">${img(x, x.image, c.headline, 572)}</div>` : ""}${plainEyebrow(x, c.eyebrow, x.pt)}${h1(x, c.headline, { size: 30 })}${para(x, c.body, { mb: 24 })}<table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="margin:0 0 26px;"><tr><td align="center" bgcolor="${x.soft}" style="background:${x.soft};border:2px dashed ${x.p};border-radius:16px;padding:26px 20px;">${c.offerLabel ? `<div style="font-size:46px;line-height:48px;font-weight:900;letter-spacing:-1.5px;color:${x.pt};">${esc(c.offerLabel)}</div>` : ""}${c.couponCode ? `<div style="margin:16px 0 0;"><table role="presentation" cellspacing="0" cellpadding="0" border="0" align="center"><tr><td bgcolor="#ffffff" style="background:#ffffff;border:1px solid ${x.line};border-radius:10px;padding:12px 28px;font-family:'Courier New',Courier,monospace;font-size:26px;line-height:30px;font-weight:800;letter-spacing:5px;color:${x.tx};">${esc(c.couponCode)}</td></tr></table></div>` : ""}${c.offerNote ? `<div style="margin-top:14px;font-size:13px;line-height:20px;color:${x.muted};">${esc(c.offerNote)}</div>` : ""}</td></tr></table>${ctas(x)}${sign(x)}`,
      { align: "center" }
    );
  },

  welcome(x) {
    const { c } = x;
    return `${x.image ? `<div style="padding:26px 34px 0;">${img(x, x.image, c.headline, 572)}</div>` : ""}${pad(
      `${plainEyebrow(x, c.eyebrow, x.pt, "left")}${h1(x, c.headline, { size: 34, align: "left", mb: 14 })}${para(x, c.body, { align: "left", mb: 20 })}${softCards(x, c.highlights)}${c.couponCode ? `<div style="margin-top:20px;text-align:left;">${c.offerLabel ? `<div style="margin:0 0 8px;font-size:15px;font-weight:700;color:${x.tx};">${esc(c.offerLabel)}</div>` : ""}${codeBox(x, { align: "left" })}${c.offerNote ? `<div style="margin:-8px 0 16px;font-size:12px;color:${x.muted};">${esc(c.offerNote)}</div>` : ""}</div>` : ""}<div style="margin-top:24px;">${ctas(x, { align: "left" })}</div>${sign(x, { align: "left" })}`,
      { top: x.image ? 26 : 38, align: "left" }
    )}`;
  },

  thankyou(x) {
    const { c } = x;
    return pad(
      `<table role="presentation" cellspacing="0" cellpadding="0" border="0" align="center" style="margin:0 auto 22px;"><tr><td width="68" height="68" align="center" bgcolor="${x.soft}" style="width:68px;height:68px;background:${x.soft};border-radius:34px;font-size:32px;line-height:68px;font-weight:800;color:${x.pt};">&#10003;</td></tr></table>${plainEyebrow(x, c.eyebrow, x.pt)}${h1(x, c.headline, { size: 32, mb: 14 })}${para(x, c.body, { mb: 20 })}${x.image ? `<div style="margin:6px 0 22px;">${img(x, x.image, c.headline, 572)}</div>` : ""}${checkList(x, c.highlights)}${c.couponCode ? `<div style="margin-top:14px;">${c.offerLabel ? `<div style="margin:0 0 10px;font-size:15px;font-weight:700;color:${x.tx};">${esc(c.offerLabel)}</div>` : ""}${codeBox(x)}${c.offerNote ? `<div style="margin:-8px 0 16px;font-size:12px;color:${x.muted};">${esc(c.offerNote)}</div>` : ""}</div>` : ""}${x.items.length ? `<div style="border-top:1px solid ${x.line};margin:22px 0 4px;padding-top:24px;">${grid(x, x.items, x.items.length >= 3 ? 3 : 2)}</div>` : ""}<div style="margin-top:10px;">${ctas(x)}</div>${sign(x)}`,
      { top: 40, align: "center" }
    );
  },

  winback(x) {
    const { c } = x;
    return `${pad(
      `${plainEyebrow(x, c.eyebrow, x.pt)}${h1(x, c.headline, { size: 34, mb: 14 })}${para(x, c.body, { color: mix(x.tx, "#ffffff", 0.25), mb: 22 })}${
        c.offerLabel || c.couponCode
          ? `<table role="presentation" cellspacing="0" cellpadding="0" border="0" align="center" style="margin:0 auto 24px;"><tr><td bgcolor="#ffffff" align="center" style="background:#ffffff;border-radius:${x.imgRadius + 2}px;padding:20px 32px;">${c.offerLabel ? `<div style="font-size:28px;line-height:32px;font-weight:900;color:${x.pt};">${esc(c.offerLabel)}</div>` : ""}${c.couponCode ? `<div style="margin-top:8px;font-family:'Courier New',Courier,monospace;font-size:20px;letter-spacing:3px;font-weight:800;color:${x.tx};">${esc(c.couponCode)}</div>` : ""}${c.offerNote ? `<div style="margin-top:8px;font-size:12px;color:${x.muted};">${esc(c.offerNote)}</div>` : ""}</td></tr></table>`
          : ""
      }${x.image ? `<div style="margin:0 0 24px;">${img(x, x.image, c.headline, 572)}</div>` : ""}${ctas(x)}`,
      { top: 40, bottom: 38, bg: x.soft, align: "center" }
    )}${x.items.length || c.signature || c.closingNote ? pad(`${x.items.length ? `<div style="margin:0 0 16px;font-size:15px;font-weight:700;color:${x.tx};text-align:center;">Still on your mind?</div>` : ""}${grid(x, x.items, x.items.length >= 3 ? 3 : 2)}${sign(x)}`, { top: 30, bottom: 20, align: "center" }) : ""}`;
  },

  review(x) {
    const { c } = x;
    return pad(
      `${x.image ? `<div style="margin-bottom:26px;">${img(x, x.image, c.headline, 572)}</div>` : ""}<div style="font-size:38px;line-height:44px;letter-spacing:6px;color:${x.acc === x.a ? x.pt : x.acc};margin-bottom:14px;">&#9733;&#9733;&#9733;&#9733;&#9733;</div>${plainEyebrow(x, c.eyebrow, x.pt)}${h1(x, c.headline, { size: 30 })}${para(x, c.body, { mb: 24 })}${x.items.length ? `<div style="margin:0 0 20px;">${thumbRows(x, x.items.slice(0, 2))}</div>` : ""}${ctas(x)}${sign(x)}`,
      { top: 40, align: "center" }
    );
  },

  event(x) {
    const { c } = x;
    const hasDetails = c.eventDate || c.eventTime || c.eventLocation;
    const rows = [
      detailRow(x, "Date", c.eventDate, !c.eventTime && !c.eventLocation),
      detailRow(x, "Time", c.eventTime, !c.eventLocation),
      detailRow(x, "Where", c.eventLocation, true),
    ].join("");
    return `${fullBleed(x, c.headline)}${pad(
      `<div style="margin-bottom:16px;">${pill(c.eyebrow, x.p, x.onP)}</div>${h1(x, c.headline, { size: 34, align: "left" })}${para(x, c.body, { align: "left", mb: 22 })}${hasDetails ? `<table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="margin:0 0 24px;background:${x.soft};border-radius:${x.imgRadius + 2}px;"><tr><td style="padding:6px 22px;"><table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0">${rows}</table></td></tr></table>` : ""}${c.highlights?.length ? `<div style="margin:0 0 6px;">${checkList(x, c.highlights)}</div>` : ""}<div style="margin-top:12px;">${ctas(x, { align: "left" })}</div>${sign(x, { align: "left" })}`,
      { top: x.image ? 30 : 38, align: "left" }
    )}`;
  },

  holiday(x) {
    const { c } = x;
    return pad(
      `<div style="font-size:18px;letter-spacing:12px;color:${x.pt};margin-bottom:16px;">&#10022; &#10022; &#10022;</div>${c.eyebrow ? `<div style="margin:0 0 10px;font-size:15px;font-style:italic;color:${x.muted};">${esc(c.eyebrow)}</div>` : ""}${h1(x, c.headline, { size: 40, mb: 18, ls: "-0.5px" })}${x.image ? `<div style="margin:0 0 24px;">${img(x, x.image, c.headline, 572)}</div>` : ""}${para(x, c.body, { size: 16, lh: 27, color: mix(x.tx, "#ffffff", 0.22), mb: 20 })}${c.offerLabel ? `<div style="margin:6px 0 18px;font-size:20px;font-weight:700;color:${x.pt};">${esc(c.offerLabel)}</div>` : ""}${c.couponCode ? codeBox(x) : ""}${c.offerNote ? `<p style="margin:-6px 0 18px;font-size:13px;color:${x.muted};">${esc(c.offerNote)}</p>` : ""}${c.ctaLabel ? `<div style="margin-top:8px;">${ctas(x, { outline: true })}</div>` : ""}${sign(x, { color: x.tx })}<div style="margin-top:26px;font-size:14px;letter-spacing:10px;color:${x.pt};">&#10022; &#10022; &#10022;</div>`,
      { top: 44, bottom: 40, bg: x.soft, align: "center" }
    );
  },

  service(x) {
    const { c } = x;
    return pad(
      `${caps(x, c.eyebrow, x.pt)}${h1(x, c.headline, { size: 32 })}${para(x, c.body, { mb: 22 })}${x.image ? `<div style="margin-bottom:24px;">${img(x, x.image, c.headline, 572)}</div>` : ""}${serviceList(x, x.items)}${c.highlights?.length ? `<div style="margin-top:22px;">${checkList(x, c.highlights)}</div>` : ""}<div style="margin-top:24px;">${ctas(x)}</div>${sign(x)}`,
      { align: x.align }
    );
  },

  luxury(x) { const { c } = x; return `${x.image ? `<div style="padding:28px 34px 0;background:${x.soft};">${img(x,c.imageUrl||x.image,c.headline,572)}</div>` : ""}${pad(`${caps(x,c.eyebrow,x.pt)}${h1(x,c.headline,{size:38,ls:"-0.8px",mb:16})}${para(x,c.body,{size:16,lh:27,mb:24})}${c.highlights?.length ? featureRows(x,c.highlights,{color:x.pt}) : ""}${itemsBlock(x,grid(x,c.items,c.items.length>=3?3:2),24)}<div style="margin-top:24px;">${ctas(x)}</div>${sign(x)}`,{top:34,bottom:34,align:"left"})}`; },

  editorial(x) { const { c } = x; return pad(`${plainEyebrow(x,c.eyebrow,x.pt,"left")}${h1(x,c.headline,{size:40,align:"left",ls:"-1px",mb:16})}${x.image ? `<div style="margin:0 0 26px;">${img(x,x.image,c.headline,572)}</div>` : ""}${para(x,c.body,{size:16,lh:28,align:"left",mb:20})}${c.highlights?.length ? softCards(x,c.highlights) : ""}${x.items.length ? `<div style="border-top:1px solid ${x.line};margin-top:24px;padding-top:20px;">${thumbRows(x,x.items)}</div>` : ""}<div style="margin-top:20px;">${ctas(x,{align:"left"})}</div>${sign(x,{align:"left"})}`,{top:38,align:"left"}); },

  product_grid(x) { const { c } = x; return pad(`${plainEyebrow(x,c.eyebrow,x.pt)}${h1(x,c.headline,{size:34,mb:12})}${para(x,c.body,{mb:22})}${grid(x,c.items,2)}<div style="margin-top:24px;">${ctas(x)}</div>${sign(x)}`,{top:34,align:"center"}); },

  premium_offer(x) { const { c } = x; return `${pad(`${c.eyebrow ? `<div style="font-size:12px;letter-spacing:3px;text-transform:uppercase;font-weight:800;color:${x.pt};margin-bottom:14px;">${esc(c.eyebrow)}</div>` : ""}${c.offerLabel ? `<div style="font-size:64px;line-height:66px;font-weight:900;letter-spacing:-2px;color:${x.pt};margin-bottom:12px;">${esc(c.offerLabel)}</div>` : ""}${h1(x,c.headline,{size:30,mb:14})}${para(x,c.body,{size:16,lh:26,mb:22})}${c.couponCode ? codeBox(x) : ""}${c.offerNote ? `<div style="margin:12px 0 20px;font-size:13px;color:${x.muted};">${esc(c.offerNote)}</div>` : ""}${ctas(x)}${sign(x)}`,{top:44,bottom:40,bg:x.soft,align:"center"})}${x.items.length ? pad(grid(x,x.items,2),{top:26,bottom:24}) : ""}`; },

  hotel_signature(x) { const { c } = x; return `${fullBleed(x,x.brand.name)}${pad(`${caps(x,c.eyebrow,x.pt)}${h1(x,c.headline,{size:36,mb:14})}${para(x,c.body,{size:16,lh:27,mb:22})}${c.offerLabel ? `<table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="margin-bottom:22px;border-top:1px solid ${x.line};border-bottom:1px solid ${x.line};"><tr><td style="padding:16px 0;text-align:left;"><div style="font-size:11px;letter-spacing:2px;text-transform:uppercase;color:${x.muted};">Special rate</div><div style="font-size:25px;line-height:30px;font-weight:800;color:${x.pt};">${esc(c.offerLabel)}</div>${c.offerNote ? `<div style="font-size:13px;color:${x.muted};">${esc(c.offerNote)}</div>` : ""}</td></tr></table>` : ""}${c.highlights?.length ? checkList(x,c.highlights) : ""}${x.items.length ? itemsBlock(x,grid(x,x.items,1),18) : ""}<div style="margin-top:22px;">${ctas(x,{align:"left"})}</div>${sign(x,{align:"left"})}`,{align:"left"})}`; },

  ref_confirmation(x) { return generatedConfirmation(x); },
  ref_offer(x) { return `${generatedBrandBar(x,"A little something extra.")}${generatedSplitHero(x,{offer:x.c.offerLabel||"20% OFF",headline:x.c.headline,body:x.c.body,button:x.c.ctaLabel,image:x.c.imageUrl})}${x.c.highlights?.length?pad(featureRows(x,x.c.highlights,{color:x.pt}),{top:18,bottom:18}):""}${refSocialFooter(x)}`; },
  ref_catalog(x) { return generatedCatalog(x); },
  ref_journey(x) { return `${generatedBrandBar(x,"Ideas, tips and experiences.")}${generatedSplitHero(x,{headline:x.c.headline,body:x.c.body,button:x.c.ctaLabel,image:x.c.imageUrl})}${refSectionTitle(x,"Travel tips & insights")}${refTwoCol(x,(x.c.highlights??[]).map(t=>({name:t,description:"Helpful guidance for your customers."})))}${refSectionTitle(x,"Popular selection")}${grid(x,x.items.slice(0,4),2)}${refSocialFooter(x)}`; },
  ref_thankyou(x) { return generatedConfirmation(x); },
  ref_editorial(x) { return generatedEditorial(x); },
  ref_pricing(x) { const c=x.c; return `${generatedBrandBar(x,"Clear options. Straightforward value.")}${pad(`${caps(x,c.eyebrow,x.pt)}${h1(x,c.headline,{size:38,align:"left"})}${para(x,c.body,{align:"left",mb:20})}`,{top:34,bottom:20,align:"left",bg:x.soft})}<table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0"><tr><td width="50%" style="padding:25px 20px 25px 34px;border-right:1px solid ${x.line};"><div style="font-size:11px;text-transform:uppercase;letter-spacing:1.5px;color:${x.muted};">${esc(c.offerLabel||"Current rate")}</div><div style="margin-top:8px;font-size:28px;font-weight:900;color:${x.pt};">${esc(c.couponCode||"Available now")}</div></td><td width="50%" style="padding:25px 34px 25px 20px;"><div style="font-size:11px;text-transform:uppercase;letter-spacing:1.5px;color:${x.muted};">${esc(c.offerNote||"Flexible option")}</div><div style="margin-top:8px;font-size:28px;font-weight:900;color:${x.pt};">${esc(c.ctaLabel||"Learn more")}</div></td></tr></table>${c.highlights?.length?pad(featureRows(x,c.highlights,{color:x.pt}),{top:8,bottom:18}):""}${pad(ctas(x,{align:"left"}),{top:8,bottom:22,align:"left"})}${refSocialFooter(x)}`; },
  ref_hotel(x) { return generatedHotel(x); },
  ref_restaurant(x) { return generatedRestaurant(x); },
  ref_food_catalog(x) { return `${generatedBrandBar(x,"Good food, thoughtfully prepared.")}${generatedCatalog(x)}`; },
  ref_dark_menu(x) { return generatedDarkMenu(x); },
  ref_product_launch(x) { const c=x.c; return `${generatedBrandBar(x,"Meet what’s new.")}${generatedSplitHero(x,{headline:c.headline,body:c.body,button:c.ctaLabel,image:c.imageUrl})}${c.highlights?.length?pad(`${refSectionTitle(x,"Why it matters")}${featureRows(x,c.highlights,{color:x.pt})}`,{top:12,bottom:18}):""}${c.items.length?`${refSectionTitle(x,"Explore")}${grid(x,c.items.slice(0,4),2)}`:""}${refSocialFooter(x)}`; },
  minimal_pro(x) { const { c } = x; return pad(`${plainEyebrow(x,c.eyebrow,x.pt,"left")}${h1(x,c.headline,{size:32,align:"left",mb:12})}${para(x,c.body,{size:15,lh:25,align:"left",mb:20})}${c.highlights?.length ? featureRows(x,c.highlights,{color:x.pt}) : ""}${x.items.length ? `<div style="margin-top:20px;">${thumbRows(x,x.items)}</div>` : ""}<div style="margin-top:22px;">${ctas(x,{align:"left"})}</div>${sign(x,{align:"left"})}`,{top:34,align:"left"}); },

  hospitality(x) {
    const { c } = x;
    return `${fullBleed(x, x.brand.name)}${pad(
      `${caps(x, c.eyebrow, x.pt)}${h1(x, c.headline, { size: 34 })}${para(x, c.body, { mb: 22 })}${
        c.offerLabel
          ? `<table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="margin:0 0 24px;border-top:1px solid ${x.line};border-bottom:1px solid ${x.line};"><tr><td style="padding:16px 0;text-align:${x.align};"><div style="font-size:12px;color:${x.muted};">Special rate</div><div style="margin-top:2px;font-size:20px;line-height:26px;font-weight:800;color:${x.pt};">${esc(c.offerLabel)}</div>${c.offerNote ? `<div style="margin-top:2px;font-size:13px;color:${x.muted};">${esc(c.offerNote)}</div>` : ""}</td></tr></table>`
          : ""
      }${checkList(x, c.highlights)}${itemsBlock(x, grid(x, x.items, 1), 14)}<div style="margin-top:8px;">${ctas(x)}</div>${sign(x)}`,
      { align: x.align }
    )}`;
  },

  restaurant(x) {
    const { c } = x;
    return `${pad(
      `${c.eyebrow ? `<div style="margin:0 0 8px;font-size:15px;font-style:italic;color:${x.muted};">${esc(c.eyebrow)}</div>` : ""}${h1(x, c.headline, { size: 38, mb: 14 })}<div style="width:56px;height:2px;background:${x.p};margin:0 auto 18px;font-size:1px;line-height:2px;">&nbsp;</div>${para(x, c.body, { size: 16, lh: 26, color: mix(x.tx, "#ffffff", 0.22), mb: 22 })}${x.image ? `<div style="margin:0 0 26px;">${img(x, x.image, c.headline, 572)}</div>` : ""}${menuList(x, x.items)}`,
      { top: 42, bottom: 28, bg: x.soft, align: "center" }
    )}${pad(`${c.highlights?.length ? `<p style="margin:0 0 22px;font-size:14px;line-height:22px;color:${x.muted};text-align:center;">${c.highlights.map(esc).join(" &nbsp;&middot;&nbsp; ")}</p>` : ""}${ctas(x)}${sign(x)}`, { top: 28, bottom: 30, align: "center" })}`;
  },

  letter(x) {
    const { c } = x;
    return pad(
      `${x.image ? `<div style="margin:0 0 24px;">${img(x, x.image, c.headline || x.brand.name, 300)}</div>` : ""}<p style="margin:0 0 16px;font-size:17px;line-height:26px;color:${x.tx};">${x.greeting}</p>${c.headline ? `<p style="margin:0 0 16px;font-size:20px;line-height:28px;font-weight:700;color:${x.tx};">${esc(c.headline)}</p>` : ""}${para(x, c.body, { size: 17, lh: 27, color: x.tx, mb: 16 })}${c.ctaLabel ? `<p style="margin:6px 0 0;font-size:17px;line-height:27px;"><a href="${safeUrl(c.ctaUrl, storeUrl(x))}" style="color:${x.pt};font-weight:700;text-decoration:underline;">${esc(c.ctaLabel)}</a></p>` : ""}${c.secondaryCtaLabel ? `<p style="margin:6px 0 0;font-size:17px;line-height:27px;"><a href="${safeUrl(c.secondaryCtaUrl, storeUrl(x))}" style="color:${x.pt};font-weight:700;text-decoration:underline;">${esc(c.secondaryCtaLabel)}</a></p>` : ""}${sign(x, { align: "left" })}`,
      { top: 36, bottom: 34, align: "left" }
    );
  },
};

/* -------------------------------------------------------------------------- */
/*  Starter copy                                                               */
/* -------------------------------------------------------------------------- */

function industryOf(brand: MarketingBrand) {
  const type = (brand.businessType ?? "").toLowerCase();
  return {
    hospitality: /hotel|lodging|hospitality|resort|guest/.test(type),
    food: /restaurant|food|cafe|bakery|bar|catering/.test(type),
    beauty: /salon|barber|spa|beauty|nail/.test(type),
    professional: /agency|consult|studio|photography|creative|service/.test(type),
  };
}

function prefer(items: MarketingItem[], kind: "product" | "service", n: number) {
  return [...items.filter((i) => i.kind === kind), ...items.filter((i) => i.kind !== kind)].slice(0, n);
}

/** Starter content for a design, tuned to the store's industry. Everything is editable. */
export function defaultMarketingContent(template: MarketingTemplateId, brand: MarketingBrand, items: MarketingItem[]): MarketingDefaults {
  const ind = industryOf(brand);
  const url = `${APP_URL}/${brand.slug}`;
  const name = brand.name;
  const hero = brand.bannerUrl ?? items.find((i) => i.imageUrl)?.imageUrl ?? null;
  const itemHero = items.find((i) => i.imageUrl)?.imageUrl ?? brand.bannerUrl ?? null;
  const team = `The ${name} team`;
  const base = { ctaUrl: url, imageUrl: hero, items: [] as MarketingItem[] };
  const buy = ind.hospitality ? "Book your stay" : ind.beauty || ind.professional ? "Book now" : ind.food ? "Order now" : "Shop now";

  switch (template) {
    case "launch":
      return { ...base, subject: "Just launched: something new from " + name, previewText: "Be one of the first to see it.", eyebrow: "New", headline: "Meet the newest thing at " + name, body: "We've been working on this for a while and we're excited to finally share it. Take a look and tell us what you think.", ctaLabel: "See what's new", items: items.slice(0, 2), highlights: ["Made with care, built to last", "Easy to order, quick to receive", "Questions? We're one message away"], imageUrl: itemHero };
    case "showcase":
      return { ...base, subject: "Fresh picks from " + name, previewText: "A few things we think you'll love.", eyebrow: ind.food ? "From our kitchen" : "Featured picks", headline: ind.food ? "Good things are on the menu." : "A few things we think you'll love.", body: "Hand-picked from our latest collection. Tap any item to see the full details.", ctaLabel: brand.sellsProducts ? "View everything" : "Learn more", items: prefer(items, "product", 4), imageUrl: itemHero };
    case "newsletter":
      return { ...base, subject: "The latest from " + name, previewText: "News, picks and a few useful things.", eyebrow: "Latest update", headline: "A quick update from our business.", body: brand.businessDescription ?? "Here's what's been happening at our business, plus a few things we think are worth your time.", ctaLabel: "Visit our website", items: items.slice(0, 3), highlights: ["What's new this month", "A tip we love", "Coming up next"] };
    case "promotion":
      return { ...base, subject: ind.hospitality ? "A special offer for your next stay" : "A special offer, just for you", previewText: "Available for a limited time.", eyebrow: ind.hospitality ? "Limited stay offer" : ind.food ? "This week only" : "Limited-time offer", offerLabel: "20% off", couponCode: "", offerNote: "Offer ends soon. Terms apply.", headline: ind.hospitality ? "Make your next stay feel special." : ind.beauty ? "A little self-care goes a long way." : "Something special is waiting for you.", body: ind.hospitality ? "Enjoy a memorable stay with a thoughtful offer from our team. Reserve while availability lasts." : ind.food ? "Treat yourself to something delicious. Have a look at this week's picks and enjoy a special offer." : "We put together a special offer for our community. Take a look before it ends.", ctaLabel: ind.hospitality ? "Book your stay" : "Shop the offer", items: items.slice(0, 2 + (items.length > 3 ? 2 : 0)), imageUrl: hero };
    case "flash":
      return { ...base, subject: "Flash sale: ends soon", previewText: "Our biggest discount, for a short time only.", eyebrow: "Flash sale", offerLabel: "40% off", couponCode: "", offerNote: "Ends tonight at midnight", headline: "Prices this low don't last.", body: "For a short time only, enjoy a big saving on selected favourites. When it's gone, it's gone.", ctaLabel: buy, items: items.slice(0, 2), imageUrl: null };
    case "coupon":
      return { ...base, subject: "Your discount code is inside", previewText: "Use it on your next order.", eyebrow: "A little thank you", headline: "Here's something for your next visit.", body: "Use the code below at checkout to enjoy a discount with us.", offerLabel: "15% off", couponCode: "THANKS15", offerNote: "Valid for a limited time. One use per customer.", ctaLabel: "Use my code", imageUrl: null };
    case "welcome":
      return { ...base, subject: "Welcome to " + name, previewText: "Thanks for joining. Here's what to expect.", eyebrow: "Welcome to " + name, headline: "We're so glad you're here.", body: "Thanks for subscribing. You'll hear from us when there's something worth sharing: new arrivals, helpful ideas and the occasional treat.", ctaLabel: "Take a look around", highlights: ["News and new arrivals, first", "Helpful ideas, no spam", "Offers just for subscribers"], offerLabel: "", couponCode: "", offerNote: "", signature: "Warmly,\n" + team, imageUrl: null };
    case "thankyou":
      return { ...base, subject: "Thank you from " + name, previewText: "We really appreciate your support.", eyebrow: "Thank you", headline: "You made our day.", body: "Thank you for choosing " + name + ". Your support means a great deal to a small team, and we hope you love it.", ctaLabel: "Visit our website", highlights: ["We're preparing everything with care", "You'll get an update as soon as it's ready", "Reply to this email if you need anything"], items: items.slice(0, 3), signature: "With thanks,\n" + team, imageUrl: null };
    case "winback":
      return { ...base, subject: "We've missed you at " + name, previewText: "Come back and see what's new.", eyebrow: "It's been a while", headline: "We've missed you.", body: "A lot has happened since your last visit. Come back and see what's new. We saved something for you.", offerLabel: "10% off your next order", couponCode: "", offerNote: "", ctaLabel: "Come back and look around", items: items.slice(0, 3), signature: "Hope to see you soon,\n" + team, imageUrl: null };
    case "review":
      return { ...base, subject: "How did we do?", previewText: "Your feedback takes about a minute.", eyebrow: "", headline: "How was your experience?", body: "Your honest feedback helps us improve and helps others decide with confidence. It takes less than a minute.", ctaLabel: "Leave a review", secondaryCtaLabel: "Something not right? Tell us", secondaryCtaUrl: brand.contactEmail ? `mailto:${brand.contactEmail}` : url, items: [], signature: "Thank you,\n" + team, imageUrl: null };
    case "letter":
      return { ...base, subject: "A quick note from " + name, previewText: "Just a short personal update.", eyebrow: "", headline: "", body: "I wanted to write you a short note.\n\nWrite what you'd say to a customer face to face: what's new, what you're grateful for, or what you'd like them to know. Keep it short and sound like yourself.", ctaLabel: "Have a look here", signature: "Warm regards,\n" + name, imageUrl: null };
    case "event":
      return { ...base, subject: "You're invited: " + name, previewText: "Save the date and reserve your spot.", eyebrow: "You're invited", headline: "Join us for something special.", body: "We'd love to see you there. Come along, meet the team and enjoy the day with us.", eventDate: "Saturday, 12 October", eventTime: "6:00 PM to 9:00 PM", eventLocation: name, highlights: ["Meet the team", "Refreshments provided", "Space is limited, so reserve early"], ctaLabel: "Reserve my spot", secondaryCtaLabel: "", imageUrl: hero };
    case "holiday":
      return { ...base, subject: "Warm wishes from " + name, previewText: "Thank you for being part of our year.", eyebrow: "With gratitude", headline: "Warm wishes to you and yours.", body: "As the season arrives, we want to say thank you. It's been a pleasure serving you, and we look forward to what's ahead together.", ctaLabel: "See what's new", offerLabel: "", couponCode: "", offerNote: "", signature: "With warm wishes,\n" + team, imageUrl: null };
    case "service": {
      const services = prefer(items, "service", 4);
      return { ...base, subject: ind.beauty ? "Ready for your next appointment?" : "Let's plan your next project", previewText: "See what we offer and book online.", eyebrow: ind.beauty ? "Your next appointment" : ind.professional ? "What we do" : "Featured service", headline: ind.beauty ? "Ready for your next appointment?" : "Let's make your next project easier.", body: ind.beauty ? "Explore our services, choose what fits you and book directly from our website." : brand.businessDescription ?? "Discover a service designed around your goals, your schedule and your experience.", ctaLabel: ind.beauty ? "Book now" : "Explore services", items: services, highlights: ["Book online in a minute", "Clear pricing, no surprises"], imageUrl: services.find((i) => i.imageUrl)?.imageUrl ?? brand.bannerUrl };
    }
    case "hospitality":
      return { ...base, subject: "Plan your stay with " + name, previewText: "Rooms, amenities and easy online booking.", eyebrow: "Welcome to " + name, headline: "Your stay, beautifully considered.", body: "See our rooms, amenities and availability, then reserve your preferred stay in a few clicks.", offerLabel: "", offerNote: "", ctaLabel: "View rooms and book", items: items.slice(0, 3), highlights: ["Easy online booking", "Friendly, attentive service"], imageUrl: hero };
    case "restaurant":
      return { ...base, subject: "This week on the menu at " + name, previewText: "Fresh dishes, ready when you are.", eyebrow: "Chef's selection", headline: "On the menu this week", body: "A few favourites we're especially proud of right now. Come hungry.", ctaLabel: ind.food ? "Order or reserve" : "Order now", items: prefer(items, "product", 6), highlights: ["Open daily", "Delivery available"], imageUrl: null };
    case "luxury": return { ...base, subject: "A private update from " + name, previewText: "A refined selection, curated for you.", eyebrow: "A considered selection", headline: "Something worth discovering.", body: brand.businessDescription ?? "Explore our latest offering, thoughtfully selected for our customers.", ctaLabel: buy, items: items.slice(0,4), highlights: ["Thoughtfully selected", "Personal service", "Designed around you"], imageUrl: hero };
    case "editorial": return { ...base, subject: "The latest from " + name, previewText: "A story, a few highlights and what's next.", eyebrow: "The journal", headline: "What we're excited about right now.", body: brand.businessDescription ?? "A closer look at what is new, useful and worth knowing from our team.", ctaLabel: "Read more", items: items.slice(0,3), highlights: ["What's new", "Behind the scenes", "Coming next"], imageUrl: hero };
    case "product_grid": return { ...base, subject: "Curated picks from " + name, previewText: "Explore our latest collection.", eyebrow: "Featured collection", headline: "Selected for you.", body: "Explore a curated selection of products and services from our latest collection.", ctaLabel: buy, items: items.slice(0,6), imageUrl: itemHero };
    case "premium_offer": return { ...base, subject: "A special offer from " + name, previewText: "An exclusive offer for a limited time.", eyebrow: "Exclusive access", offerLabel: "20% OFF", couponCode: "", offerNote: "Limited availability. Terms apply.", headline: "A little something extra.", body: "Enjoy a special offer from our team while it is available.", ctaLabel: buy, items: items.slice(0,3), imageUrl: hero };
    case "hotel_signature": return { ...base, subject: "Your next stay at " + name, previewText: "Rooms, rates and experiences curated for your stay.", eyebrow: "Signature stay", headline: "Stay somewhere worth remembering.", body: "Discover our rooms, amenities and special offers, then reserve your preferred stay.", ctaLabel: "Explore rooms", offerLabel: "Special rate available", offerNote: "Subject to availability.", items: items.slice(0,4), highlights: ["Elegant rooms", "Attentive service", "Easy reservations"], imageUrl: hero };
    case "ref_confirmation": return { ...base, subject: "Your confirmation from " + name, previewText: "Your details and what happens next.", eyebrow: "Confirmed", headline: "You’re all set.", body: "Thanks for choosing us. Here are the details you need, plus a few useful next steps.", ctaLabel: buy, items: items.slice(0,3), highlights: ["Confirmation details", "Next steps", "Need help? Contact us"], imageUrl: hero };
    case "ref_offer": return { ...base, subject: "A special offer from " + name, previewText: "A limited-time offer selected for you.", eyebrow: "Special offer", headline: "Something special is waiting.", body: brand.businessDescription ?? "Discover a limited-time offer from our business.", ctaLabel: buy, offerLabel: "20% OFF", offerNote: "Available for a limited time.", items: items.slice(0,4), highlights: ["Selected for you", "Easy to redeem", "Terms apply"], imageUrl: hero };
    case "ref_catalog": return { ...base, subject: "Featured from " + name, previewText: "Explore our latest selection.", eyebrow: "Featured", headline: "Discover what’s new.", body: brand.businessDescription ?? "Explore our latest products, rooms or services.", ctaLabel: buy, items: items.slice(0,6), highlights: ["Quality selection", "Easy access", "Personal service"], imageUrl: hero };
    case "ref_journey": return { ...base, subject: "Explore with " + name, previewText: "Ideas, tips and featured experiences.", eyebrow: "Explore", headline: "Make the most of your next experience.", body: brand.businessDescription ?? "A few ideas and recommendations to help your customers discover more.", ctaLabel: buy, items: items.slice(0,3), highlights: ["Save smart", "Plan ahead", "Local recommendations"], imageUrl: hero };
    case "ref_thankyou": return { ...base, subject: "Thank you from " + name, previewText: "Here’s what happens next.", eyebrow: "Thank you", headline: "We appreciate you.", body: "Your support means a lot. Here’s what happens next and where to find us if you need anything.", ctaLabel: "Visit our website", highlights: ["We’re preparing your request", "You’ll receive an update", "Our team is here to help"], imageUrl: hero };
    case "ref_editorial": return { ...base, subject: "The story from " + name, previewText: "A closer look at what we offer.", eyebrow: "The story", headline: "Crafted with purpose.", body: brand.businessDescription ?? "A closer look at the thinking, people and products behind our business.", ctaLabel: "Discover more", items: items.slice(0,4), highlights: ["Thoughtful design", "Quality materials", "Made for real life"], imageUrl: hero };
    case "ref_pricing": return { ...base, subject: "New pricing from " + name, previewText: "Clear options, straightforward value.", eyebrow: "Pricing update", headline: "More value, clearly presented.", body: "See the current options and choose what fits your needs.", ctaLabel: buy, offerLabel: "From your current rate", offerNote: "Flexible option", couponCode: "Available now", highlights: ["Transparent information", "Flexible choices", "Direct support"], imageUrl: null };
    case "ref_hotel": return { ...base, subject: "Stay with " + name, previewText: "Rooms, experiences and hospitality.", eyebrow: "Your stay", headline: "Relax in comfort.", body: brand.businessDescription ?? "Discover rooms, amenities and experiences designed around your stay.", ctaLabel: "Book your stay", items: items.slice(0,4), highlights: ["Comfortable rooms", "Attentive service", "Dining and experiences"], imageUrl: hero };
    case "ref_restaurant": return { ...base, subject: "A taste of " + name, previewText: "Featured dishes and dining experiences.", eyebrow: "Featured", headline: "A taste worth remembering.", body: brand.businessDescription ?? "Explore our dining experience and a few favourites from the menu.", ctaLabel: "Reserve or order", items: items.slice(0,4), highlights: ["Fresh ingredients", "Thoughtful service", "A memorable table"], imageUrl: hero };
    case "ref_food_catalog": return { ...base, subject: "On the menu at " + name, previewText: "Explore our featured selection.", eyebrow: "Menu", headline: "Made to be enjoyed.", body: brand.businessDescription ?? "Explore a selection of dishes, products or services from our business.", ctaLabel: "View menu", items: items.slice(0,6), imageUrl: hero };
    case "ref_dark_menu": return { ...base, subject: "The menu at " + name, previewText: "Explore our featured menu.", eyebrow: "Our menu", headline: "Made for the moment.", body: brand.businessDescription ?? "Discover featured products, services or dishes.", ctaLabel: "Reserve now", items: items.slice(0,9), highlights: ["Featured selection", "Fresh today", "Reserve online"], imageUrl: null };
    case "ref_product_launch": return { ...base, subject: "Meet what’s new at " + name, previewText: "A new release worth discovering.", eyebrow: "New", headline: "Designed for what’s next.", body: brand.businessDescription ?? "Meet the latest addition to our offering.", ctaLabel: buy, items: items.slice(0,3), highlights: ["Thoughtful design", "Easy to use", "Built around your needs"], imageUrl: hero };
    case "minimal_pro": return { ...base, subject: "An update from " + name, previewText: "A concise update from our team.", eyebrow: "Business update", headline: "A clearer way forward.", body: brand.businessDescription ?? "Here is a concise update from our team, with the information you need.", ctaLabel: "Learn more", items: items.slice(0,3), highlights: ["Clear information", "Professional service", "Direct support"], imageUrl: null };
    default:
      return { ...base, subject: "Big news from " + name, previewText: "We have something new for you.", eyebrow: "A note from " + name, headline: "We have something new for you.", body: brand.businessDescription ?? "Stay close to what's new, what's useful and what's worth your attention.", ctaLabel: "Explore now", items: items.slice(0, 3), imageUrl: hero, secondaryCtaLabel: "" };
  }
}

/* -------------------------------------------------------------------------- */
/*  Render                                                                     */
/* -------------------------------------------------------------------------- */

export function renderMarketingEmail(
  template: MarketingTemplateId,
  brand: MarketingBrand,
  content: MarketingContent,
  opts?: { unsubscribeUrl?: string; recipientFirstName?: string; footerNote?: string; showUnsubscribe?: boolean }
) {
  const c = normalizeMarketingContent(content);
  const x = buildCtx(template, brand, c, opts?.recipientFirstName);
  const s = c.style ?? {};
  const bg = s.background ?? firstHex(brand.background, "#f3f4f6");
  const rawUnsub = opts?.unsubscribeUrl ?? "";
  // Exports leave a merge placeholder ({{unsubscribe_url}}) for the sending tool to fill in.
  const unsub = rawUnsub.startsWith("{{") ? rawUnsub.replace(/[^{}\w]/g, "") : safeUrl(rawUnsub, `${APP_URL}/${brand.slug}`);
  const render = RENDERERS[template] ?? RENDERERS.announcement;
  const main = render(x);
  const showLogo = s.showLogo !== false && template !== "newsletter"; // the newsletter has its own masthead
  const showDetails = s.showFooterDetails !== false;
  const onSec = readableOn(x.sec);
  const headAlign = x.align === "center" ? "center" : "left";

  const header = showLogo
    ? `<tr><td style="padding:20px 28px;border-bottom:1px solid #eeeeee;background:#ffffff;"><table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0"><tr><td valign="middle" align="${headAlign}">${brand.logoUrl ? `<img src="${safeUrl(brand.logoUrl)}" alt="${esc(brand.name)}" height="36" style="display:${headAlign === "center" ? "inline-block" : "block"};max-width:180px;height:36px;width:auto;border:0;" />` : `<div style="font-size:20px;font-weight:900;color:${x.pt};">${esc(brand.name)}</div>`}</td>${headAlign === "left" ? `<td align="right" style="font-size:11px;font-weight:700;color:#9ca3af;">${esc(brand.businessType ?? "")}</td>` : ""}</tr></table></td></tr>`
    : "";

  const links = Object.entries(brand.socialLinks ?? {}).filter(([, v]) => v).slice(0, 5);
  const social = showDetails && links.length ? `<div style="margin-top:14px;">${links.map(([n, u]) => `<a href="${safeUrl(u)}" style="display:inline-block;margin-right:12px;color:${onSec};font-size:12px;text-decoration:underline;">${esc(n)}</a>`).join("")}</div>` : "";
  const contact = showDetails && brand.contactEmail ? `<div style="margin-top:5px;font-size:11px;opacity:.75;">${esc(brand.contactEmail)}${brand.contactPhone ? ` &middot; ${esc(brand.contactPhone)}` : ""}</div>` : "";

  const showUnsub = opts?.showUnsubscribe !== false;
  const audienceLine = opts?.footerNote ?? `You are receiving this email because you subscribed to updates from ${esc(brand.name)}.`;
  const footer = `<tr><td class="pad" style="padding:22px 30px 26px;background:${x.sec};color:${onSec};text-align:left;"><div style="font-size:13px;font-weight:800;">${esc(brand.name)}</div>${contact}${social}<div style="margin-top:16px;font-size:10px;line-height:16px;opacity:.7;">${audienceLine}${showUnsub ? ` <a href="${unsub}" style="color:inherit;text-decoration:underline;">Unsubscribe</a>.` : ""}</div><div style="margin-top:7px;font-size:10px;opacity:.55;">Powered by BizNest</div></td></tr>`;

  return `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta name="x-apple-disable-message-reformatting"><title>${esc(c.headline || brand.name)}</title><style>@media only screen and (max-width:480px){.pad{padding-left:20px !important;padding-right:20px !important}.h1{font-size:28px !important}.col{display:block !important;width:100% !important;padding:0 0 20px !important}}</style></head><body style="margin:0;padding:0;background:${bg};font-family:${x.font};color:${x.tx};"><div style="display:none;max-height:0;overflow:hidden;opacity:0;">${esc(c.previewText || c.headline)}</div><table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="background:${bg};padding:28px 12px;"><tr><td align="center"><table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="max-width:640px;background:#ffffff;border-radius:18px;overflow:hidden;">${header}<tr><td style="font-family:${x.font};">${main}</td></tr>${footer}</table></td></tr></table></body></html>`;
}