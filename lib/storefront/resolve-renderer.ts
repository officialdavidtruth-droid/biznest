import {
  GRANDEUR_TEMPLATE_NAME, TASTEHOUSE_TEMPLATE_NAME, HOTEL_TEMPLATE_NAME, EXAMPLE_TEMPLATE_NAME,
  LEGACY_TEMPLATE_NAMES,
} from "@/lib/template-themes";
import { SIGNATURE_DEDICATED_RENDERER } from "@/lib/storefront/signature-renderers";

/**
 * THE one place that decides which component draws a template's HOMEPAGE.
 * Used by the live storefront (storefront-runtime.tsx) and by the preview
 * route (app/template-preview/[name]) so the two can never disagree.
 *
 * Note: TemplateDefinition.renderer (template-registry.ts) is a different thing --
 * it names the template's *journey family* (hotel / tastehouse / grandeur ...) and
 * is used by route guards. This resolver is about the homepage only.
 */
export type ScreenshotMode = "great-treasure" | "grand-vere" | "belora" | "tastehouse" | "flavora-restaurant";

export type ScreenshotPalette = {
  accent: string; bg: string; ink: string; card: string; muted: string; border: string;
  accentSoft: string; headlineFont: string; font: string;
};

export type HomeRenderer =
  | { kind: "legacy"; name: string }
  | { kind: "screenshot"; mode: ScreenshotMode; palette: ScreenshotPalette }
  | { kind: "hotel" }
  | { kind: "example" }
  | { kind: "builder" };

export type HomeRendererKind = HomeRenderer["kind"];

const SERIF = "Georgia, serif";
const SANS = "Inter, sans-serif";

export const SCREENSHOT_PALETTES: Readonly<Record<ScreenshotMode, ScreenshotPalette>> = {
  "great-treasure": { accent: "#E7A928", bg: "#07100D", ink: "#F7F3EA", card: "#101815", muted: "#B9B6AF", border: "#2C362F", accentSoft: "#6D5420", headlineFont: SERIF, font: SANS },
  "grand-vere": { accent: "#0E5B45", bg: "#FFFFFF", ink: "#15392C", card: "#FFFFFF", muted: "#777", border: "#E6E1D7", accentSoft: "#C8BEA7", headlineFont: SERIF, font: SANS },
  belora: { accent: "#7B4BC0", bg: "#F1EAF8", ink: "#2B2430", card: "#FFFFFF", muted: "#837B89", border: "#E8E0EF", accentSoft: "#D5B7EA", headlineFont: SERIF, font: SANS },
  "flavora-restaurant": { accent: "#F39A0B", bg: "#100A06", ink: "#FFF7EF", card: "#17100C", muted: "#B7A8A1", border: "#352A29", accentSoft: "#8C4722", headlineFont: SERIF, font: SANS },
  tastehouse: { accent: "#F26B21", bg: "#FFFBF5", ink: "#241608", card: "#FFFFFF", muted: "#7A6A5D", border: "#F1E4D6", accentSoft: "#FDE3D3", headlineFont: "Poppins, sans-serif", font: SANS },
};

const isScreenshotMode = (m: string | undefined): m is ScreenshotMode => !!m && m in SCREENSHOT_PALETTES;

export function resolveHomeRenderer(templateName: string | null | undefined): HomeRenderer {
  const name = templateName ?? "";
  if (name === "Aspire Resort" || name === "Larita Luxury Hotel" || name === "Skyview Hotels & Resorts") return { kind: "hotel" };
  if (["Emarket Furniture & Home", "Electra Blue Electronics", "TechNova Mobile Store", "ShopEase General Store", "ShopNova Marketplace", "TechVerse Gadgets", "Wanderly Travel", "Nestoria Real Estate"].includes(name)) return { kind: "legacy", name };
  if (LEGACY_TEMPLATE_NAMES.has(name)) return { kind: "legacy", name };
  if (name === GRANDEUR_TEMPLATE_NAME) return { kind: "screenshot", mode: "flavora-restaurant", palette: SCREENSHOT_PALETTES["flavora-restaurant"] };
  if (name === TASTEHOUSE_TEMPLATE_NAME) return { kind: "screenshot", mode: "tastehouse", palette: SCREENSHOT_PALETTES.tastehouse };
  const dedicated = SIGNATURE_DEDICATED_RENDERER[name];
  if (isScreenshotMode(dedicated)) return { kind: "screenshot", mode: dedicated, palette: SCREENSHOT_PALETTES[dedicated] };
  if (name === HOTEL_TEMPLATE_NAME) return { kind: "hotel" };
  if (name === EXAMPLE_TEMPLATE_NAME) return { kind: "example" };
  return { kind: "builder" };
}
