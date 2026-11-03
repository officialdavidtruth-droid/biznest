import { resolveHomeRenderer } from "@/lib/storefront/resolve-renderer";

/**
 * Pages that are shared by every template (catalog, search, category, cart, checkout, product, service) draw the
 * Builder's header and footer by default. That is right for Builder templates, whose home uses the same chrome.
 * Every other template draws its own home (legacy, screenshot, ...), so those pages must wear the template's skin
 * instead (TemplateShell in components/storefront/universal-section-pages.tsx).
 */
export const usesTemplateChrome = (templateName: string | null | undefined) => resolveHomeRenderer(templateName).kind !== "builder";
