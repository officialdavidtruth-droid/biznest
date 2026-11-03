/**
 * Simple vs Advanced website tooling.
 *
 * SIMPLE (the default for every store) shows the owner one "My Website" screen and hides the
 * technical editors: menu builder, display sections, layout and builder tools.
 * ADVANCED shows all of them.
 *
 * This is a display switch only. Both modes read and write the same saved data (template,
 * menu items, section overrides...), so flipping the switch never loses anything.
 */
export const SITE_MODES = ["SIMPLE", "ADVANCED"] as const;
export type SiteMode = (typeof SITE_MODES)[number];
export const DEFAULT_SITE_MODE: SiteMode = "SIMPLE";

/** Strict check for values coming from a request. */
export function isSiteMode(value: unknown): value is SiteMode {
  return value === "SIMPLE" || value === "ADVANCED";
}

/** Lenient read for stored values: anything unexpected falls back to Simple. */
export function normalizeSiteMode(value: unknown): SiteMode {
  return isSiteMode(value) ? value : DEFAULT_SITE_MODE;
}
