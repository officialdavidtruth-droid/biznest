import { z } from "zod";
import { isSafeColor, isSafeHref, isSafeImageUrl, isSecureImageUrl } from "@/lib/builder-safe";

export const BUILDER_SECTION_TYPES = [
  "hero", "catalog", "about", "stats", "features", "categories", "testimonials",
  "newsletter", "contact", "gallery", "map", "faq", "text", "imageText",
] as const;

export type BuilderSectionType = typeof BUILDER_SECTION_TYPES[number];

export type BuilderSectionSettings = {
  eyebrow?: string;
  heading?: string;
  body?: string;
  ctaLabel?: string;
  ctaHref?: string;
  image?: string;
  background?: string;
  textColor?: string;
  align?: "left" | "center" | "right";
  /** Hero only: "split" (text + image side by side, default), "centered" (stacked, centred) or "fullbleed" (text over a full-width background). */
  heroStyle?: "split" | "centered" | "fullbleed";
  /** A template's own hero composition (see components/storefront/hero-variants.tsx). Overrides heroStyle when set. */
  heroVariant?: HeroVariant;
  columns?: 1 | 2 | 3 | 4;
  padding?: "compact" | "normal" | "spacious";
  radius?: number;
  showButton?: boolean;
  /** Features and FAQ sections: the owner's own entries (feature title + text, or question + answer). */
  items?: BuilderSectionItem[];
  /** Gallery section: the owner's own uploaded images. Falls back to catalogue photos when empty. */
  images?: string[];
  /** Map section: street address or place name to show. Falls back to the business city / state / country. */
  address?: string;
};

export type BuilderSectionItem = { title: string; body?: string };

export const HERO_VARIANTS = ["poster", "editorial", "lookbook", "tiles", "arch", "ledger", "frame", "splitcard", "menu", "banner", "quiet"] as const;
export type HeroVariant = (typeof HERO_VARIANTS)[number];

export type BuilderSection = {
  id: string;
  type: BuilderSectionType;
  visible: boolean;
  settings: BuilderSectionSettings;
};

export type BuilderDesign = {
  primary: string;
  accent: string;
  background: string;
  surface: string;
  text: string;
  muted: string;
  font: string;
  headingFont: string;
  radius: number;
  containerWidth: "compact" | "standard" | "wide";
  buttonStyle: "solid" | "outline" | "pill";
  /** Structural identity of a template (so templates differ in layout, not just colours). All optional. */
  headerStyle?: "classic" | "centered" | "overlay" | "bar" | "stripe";
  footerStyle?: "columns" | "centered" | "cta" | "minimal";
  cardStyle?: "bordered" | "overlay" | "minimal" | "tall";
};

export type BuilderConfig = {
  version: 1;
  design: BuilderDesign;
  sections: BuilderSection[];
};

export const DEFAULT_BUILDER_DESIGN: BuilderDesign = {
  primary: "#123524",
  accent: "#3aab61",
  background: "#ffffff",
  surface: "#f7f8f6",
  text: "#16211c",
  muted: "#67766d",
  font: "Inter",
  headingFont: "Plus Jakarta Sans",
  radius: 16,
  containerWidth: "standard",
  buttonStyle: "solid",
};

const settingsSchema = z.object({
  eyebrow: z.string().max(120).optional(),
  heading: z.string().max(180).optional(),
  body: z.string().max(4000).optional(),
  ctaLabel: z.string().max(80).optional(),
  ctaHref: z.string().max(500).refine(isSafeHref, "Button link must be a page path, #anchor, http(s), mailto: or tel: link.").optional(),
  image: z.string().max(2000).refine(isSafeImageUrl, "Image must be an http(s) URL or a site path.").optional(),
  background: z.string().max(100).refine(isSafeColor, "Invalid colour.").optional(),
  textColor: z.string().max(100).refine(isSafeColor, "Invalid colour.").optional(),
  align: z.enum(["left", "center", "right"]).optional(),
  heroStyle: z.enum(["split", "centered", "fullbleed"]).optional(),
  heroVariant: z.enum(HERO_VARIANTS).optional(),
  columns: z.union([z.literal(1), z.literal(2), z.literal(3), z.literal(4)]).optional(),
  padding: z.enum(["compact", "normal", "spacious"]).optional(),
  radius: z.number().min(0).max(48).optional(),
  showButton: z.boolean().optional(),
  items: z.array(z.object({ title: z.string().max(160), body: z.string().max(1200).optional() })).max(12).optional(),
  images: z.array(z.string().max(2000).refine(isSafeImageUrl, "Image must be an http(s) URL or a site path.")).max(24).optional(),
  address: z.string().max(300).optional(),
});

const colorField = z.string().max(100).refine(isSafeColor, "Invalid colour.");

const sectionSchema = z.object({
  id: z.string().min(1).max(80),
  type: z.enum(BUILDER_SECTION_TYPES),
  visible: z.boolean(),
  settings: settingsSchema,
});

export const builderConfigSchema = z.object({
  version: z.literal(1),
  design: z.object({
    primary: colorField, accent: colorField, background: colorField,
    surface: colorField, text: colorField, muted: colorField,
    font: z.string().max(100), headingFont: z.string().max(100), radius: z.number().min(0).max(48),
    containerWidth: z.enum(["compact", "standard", "wide"]),
    buttonStyle: z.enum(["solid", "outline", "pill"]),
    headerStyle: z.enum(["classic", "centered", "overlay", "bar", "stripe"]).optional(),
    footerStyle: z.enum(["columns", "centered", "cta", "minimal"]).optional(),
    cardStyle: z.enum(["bordered", "overlay", "minimal", "tall"]).optional(),
  }),
  sections: z.array(sectionSchema).min(1).max(30),
});

export function defaultBuilderConfig(storeName: string, description?: string | null, heroImage?: string | null, businessCategory?: string | null, businessModel?: { sellsProducts?: boolean | null; offersServices?: boolean | null }): BuilderConfig {
  // Industry-aware presets are loaded lazily here to avoid a circular dependency.
  if (businessCategory) {
    const { buildIndustryHomepage } = require("@/lib/business-experience") as typeof import("@/lib/business-experience");
    return buildIndustryHomepage(businessCategory, storeName, description, heroImage, businessModel);
  }
  return {
    version: 1,
    design: { ...DEFAULT_BUILDER_DESIGN },
    sections: [
      { id: "hero", type: "hero", visible: true, settings: { eyebrow: "Welcome", heading: storeName, body: description || "Welcome to our business. Explore our products, services and information below.", ctaLabel: "Explore", ctaHref: "#catalog", image: heroImage || undefined, align: "left", padding: "spacious" } },
      { id: "catalog", type: "catalog", visible: true, settings: { eyebrow: "Explore", heading: "Our products and services", body: "Discover what this business currently offers.", columns: 4, padding: "spacious" } },
      { id: "about", type: "about", visible: true, settings: { eyebrow: "Our story", heading: "Built around what matters", body: description || "Tell customers why your business is different.", padding: "spacious" } },
      { id: "stats", type: "stats", visible: true, settings: { padding: "normal" } },
      { id: "testimonials", type: "testimonials", visible: true, settings: { eyebrow: "Customer love", heading: "What customers say", padding: "spacious" } },
      { id: "contact", type: "contact", visible: true, settings: { eyebrow: "Contact", heading: "Let's work together", padding: "spacious" } },
      { id: "newsletter", type: "newsletter", visible: true, settings: { eyebrow: "Stay in the loop", heading: "Get updates from us", padding: "normal" } },
    ],
  };
}

/**
 * The rules a layout must meet to be PUBLISHED. Reading (below) stays lenient so a layout saved under older rules
 * never makes a live store fall back to its template.
 */
export const builderConfigSaveSchema = builderConfigSchema.superRefine((config, ctx) => {
  const seen = new Set<string>();
  config.sections.forEach((section, index) => {
    if (seen.has(section.id)) ctx.addIssue({ code: "custom", path: ["sections", index, "id"], message: "Two sections share the same id. Remove one and add it again." });
    seen.add(section.id);
    if (!isSecureImageUrl(section.settings.image)) ctx.addIssue({ code: "custom", path: ["sections", index, "settings", "image"], message: "Use an https:// image link (plain http images are blocked by browsers)." });
    section.settings.images?.forEach((url, i) => {
      if (!isSecureImageUrl(url)) ctx.addIssue({ code: "custom", path: ["sections", index, "settings", "images", i], message: "Use https:// image links (plain http images are blocked by browsers)." });
    });
  });
  if (!config.sections.some((s) => s.type === "hero")) ctx.addIssue({ code: "custom", path: ["sections"], message: "Your homepage needs a Hero section." });
  if (!config.sections.some((s) => s.visible)) ctx.addIssue({ code: "custom", path: ["sections"], message: "At least one section must be visible, otherwise your homepage would be blank." });
});

/** Shown when a save is based on an older published layout than the one now live. The editor offers to overwrite. */
export const BUILDER_CONFLICT_ERROR = "Your website was published from somewhere else while you were editing.";

/** Gives repeated section ids a numeric suffix so old data with duplicates renders and selects correctly. */
function uniqueSectionIds(config: BuilderConfig): BuilderConfig {
  const seen = new Set<string>();
  let changed = false;
  const sections = config.sections.map((section) => {
    let id = section.id;
    for (let n = 2; seen.has(id); n++) id = `${section.id}-${n}`;
    seen.add(id);
    if (id === section.id) return section;
    changed = true;
    return { ...section, id };
  });
  return changed ? { ...config, sections } : config;
}

export function readBuilderConfig(value: unknown): BuilderConfig | null {
  const result = builderConfigSchema.safeParse(value);
  return result.success ? uniqueSectionIds(result.data) : null;
}
