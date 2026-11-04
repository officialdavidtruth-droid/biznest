import { resolveHomeRenderer } from "@/lib/storefront/resolve-renderer";
import { resolveEffectiveHomeRenderer } from "@/lib/storefront/saved-builder";

/**
 * Pages that are shared by every template (catalog, search, category, cart, checkout, product, service) draw the
 * Builder's header and footer by default. That is right for Builder templates, whose home uses the same chrome.
 * Every other template draws its own home (legacy, screenshot, ...), so those pages must wear the template's skin
 * instead (TemplateShell in components/storefront/universal-section-pages.tsx).
 */
export const usesTemplateChrome = (templateName: string | null | undefined) => resolveHomeRenderer(templateName).kind !== "builder";

/**
 * Same question, but honouring a layout the owner published in Customize: a published builder replaces the template's
 * own homepage, so every page after it must wear the Builder chrome too. Use this in routes; the name-only version
 * above cannot see the owner's saved layout.
 */
export const usesTemplateChromeFor = (templateName: string | null | undefined, sectionOverrides: unknown) =>
  resolveEffectiveHomeRenderer(templateName, sectionOverrides).kind !== "builder";
