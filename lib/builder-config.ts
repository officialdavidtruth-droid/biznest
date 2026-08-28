import { z } from "zod";

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
  columns?: 1 | 2 | 3 | 4;
  padding?: "compact" | "normal" | "spacious";
  radius?: number;
  showButton?: boolean;
};

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
  ctaHref: z.string().max(500).optional(),
  image: z.string().max(2000).optional(),
  background: z.string().max(100).optional(),
  textColor: z.string().max(100).optional(),
  align: z.enum(["left", "center", "right"]).optional(),
  columns: z.union([z.literal(1), z.literal(2), z.literal(3), z.literal(4)]).optional(),
  padding: z.enum(["compact", "normal", "spacious"]).optional(),
  radius: z.number().min(0).max(48).optional(),
  showButton: z.boolean().optional(),
});

const sectionSchema = z.object({
  id: z.string().min(1).max(80),
  type: z.enum(BUILDER_SECTION_TYPES),
  visible: z.boolean(),
  settings: settingsSchema,
});

export const builderConfigSchema = z.object({
  version: z.literal(1),
  design: z.object({
    primary: z.string().max(100), accent: z.string().max(100), background: z.string().max(100),
    surface: z.string().max(100), text: z.string().max(100), muted: z.string().max(100),
    font: z.string().max(100), headingFont: z.string().max(100), radius: z.number().min(0).max(48),
    containerWidth: z.enum(["compact", "standard", "wide"]),
    buttonStyle: z.enum(["solid", "outline", "pill"]),
  }),
  sections: z.array(sectionSchema).min(1).max(30),
});

export function defaultBuilderConfig(storeName: string, description?: string | null, heroImage?: string | null, businessCategory?: string | null, businessModel?: { sellsProducts?: boolean | null; offersServices?: boolean | null }): BuilderConfig {
  // Industry-aware presets are loaded lazily here to avoid a circular dependency.
  if (businessCategory) {
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const { buildIndustryHomepage } = require("@/lib/business-experience") as typeof import("@/lib/business-experience");
    return buildIndustryHomepage(businessCategory, storeName, description, heroImage, businessModel);
  }
  return {
    version: 1,
    design: { ...DEFAULT_BUILDER_DESIGN },
    sections: [
      { id: "hero", type: "hero", visible: true, settings: { eyebrow: "Welcome", heading: storeName, body: description || "Build a storefront that feels like your business.", ctaLabel: "Explore", ctaHref: "#catalog", image: heroImage || undefined, align: "left", padding: "spacious" } },
      { id: "catalog", type: "catalog", visible: true, settings: { eyebrow: "Featured", heading: "Shop our collection", body: "Discover our latest products and services.", columns: 4, padding: "spacious" } },
      { id: "about", type: "about", visible: true, settings: { eyebrow: "Our story", heading: "Built around what matters", body: description || "Tell customers why your business is different.", padding: "spacious" } },
      { id: "stats", type: "stats", visible: true, settings: { padding: "normal" } },
      { id: "testimonials", type: "testimonials", visible: true, settings: { eyebrow: "Customer love", heading: "What customers say", padding: "spacious" } },
      { id: "contact", type: "contact", visible: true, settings: { eyebrow: "Contact", heading: "Let's work together", padding: "spacious" } },
      { id: "newsletter", type: "newsletter", visible: true, settings: { eyebrow: "Stay in the loop", heading: "Get updates from us", padding: "normal" } },
    ],
  };
}

/**
 * Builds a BuilderConfig from any resolved TemplateTheme (legacy template,
 * Signature Collection mode, Hotel mode, or a future template that hasn't
 * been written yet). This is the universal fallback that lets EVERY store
 * render through BuilderStorefront — and therefore get the click-to-edit
 * inspector + content panel — the moment a template is picked, even before
 * the owner has ever opened the customizer.
 *
 * Because this reads its copy/colors purely from `resolveStoreTheme()`
 * (see lib/template-themes.ts), a brand new template automatically gets
 * this for free as soon as it's added to that theme resolver — no changes
 * needed here or in the storefront router.
 */
export function themeBuilderConfig(
  theme: {
    accent: string; bg: string; ink: string; card: string; muted?: string;
    headlineFont: string; font: string; eyebrow: string; headline: string;
    sub: string; cta: string; catalogLabel: string;
  },
  storeName: string,
  description?: string | null,
  heroImage?: string | null,
): BuilderConfig {
  return {
    version: 1,
    design: {
      primary: theme.accent,
      accent: theme.accent,
      background: theme.bg,
      surface: theme.card,
      text: theme.ink,
      muted: theme.muted || `${theme.ink}99`,
      font: theme.font,
      headingFont: theme.headlineFont,
      radius: 18,
      containerWidth: "wide",
      buttonStyle: "solid",
    },
    sections: [
      { id: "hero", type: "hero", visible: true, settings: { eyebrow: theme.eyebrow, heading: theme.headline, body: description || theme.sub, ctaLabel: theme.cta, ctaHref: "#catalog", image: heroImage || undefined, align: "left", padding: "spacious" } },
      { id: "stats", type: "stats", visible: true, settings: { padding: "normal" } },
      { id: "about", type: "about", visible: true, settings: { eyebrow: "Designed around your business", heading: "Everything you need, beautifully presented.", body: description || theme.sub, padding: "spacious" } },
      { id: "catalog", type: "catalog", visible: true, settings: { eyebrow: theme.catalogLabel, heading: theme.catalogLabel, columns: 4, padding: "spacious" } },
      { id: "testimonials", type: "testimonials", visible: true, settings: { eyebrow: "Customer love", heading: "What customers say", padding: "spacious" } },
      { id: "contact", type: "contact", visible: true, settings: { eyebrow: "Contact", heading: "Get in touch", padding: "spacious" } },
      { id: "newsletter", type: "newsletter", visible: true, settings: { eyebrow: "Stay in the loop", heading: "Get updates from us", padding: "normal" } },
    ],
  };
}

export function readBuilderConfig(value: unknown): BuilderConfig | null {
  const result = builderConfigSchema.safeParse(value);
  return result.success ? result.data : null;
}
