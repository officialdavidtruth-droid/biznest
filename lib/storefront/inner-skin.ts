import type { TemplateTheme } from "@/lib/template-themes";

/**
 * ONE place that turns a store's template into the look of its INNER pages (About, Contact, Services, Pricing,
 * Portfolio, FAQ, Policies, Reviews). Those pages share one layout (components/storefront/universal-section-pages.tsx),
 * and before this existed that layout was hard-coded navy + white, so every template's home page looked like
 * its own site and every inner page looked like the same generic one.
 *
 * Now the layout reads CSS variables set here, so a template's inner pages carry its colours, fonts, corner
 * radius and header/footer tone. Add a template-specific entry to HOME_MATCHED only when the template's home
 * page hard-codes values that differ from its theme tokens.
 */

type Skin = {
  /** Registry-name matcher for templates whose home hard-codes its look. */
  bg?: string; ink?: string; accent?: string; dark?: string; font?: string; head?: string;
  /** Corner radius of buttons / cards. "999px" gives the pill buttons Wanderly and Nestoria use. */
  btn?: string; card?: string;
  /** Footer shape: "round" gives the rounded dark footer slab Wanderly uses. */
  footer?: "flat" | "round";
  /** Serif headline fonts look heavy at the platform's 900 weight and tight tracking; ease them. */
  serif?: boolean;
  /** Replaces the default Home / Services / About / Portfolio / Pricing / Contact nav. [label, path under the store]. */
  nav?: [string, string][];
  cta?: { label: string; path: string };
};


/** Templates whose dedicated home page draws its own header, fonts and footer. Empty now that Wanderly and Nestoria render through the Builder; add an entry only for a template whose home hard-codes a look that differs from its theme. */
export const HOME_MATCHED: Record<string, Skin> = {
};

export const skinFor = (templateName: string | null | undefined): Skin | undefined => (templateName ? HOME_MATCHED[templateName] : undefined);

const hex = (c: string) => {
  const m = /^#?([0-9a-f]{3}|[0-9a-f]{6})$/i.exec(c.trim());
  if (!m) return null;
  const h = m[1].length === 3 ? m[1].split("").map((x) => x + x).join("") : m[1];
  return [parseInt(h.slice(0, 2), 16), parseInt(h.slice(2, 4), 16), parseInt(h.slice(4, 6), 16)] as const;
};
/** Relative luminance 0..1; unknown colours count as light. */
const lum = (c: string) => {
  const rgb = hex(c);
  if (!rgb) return 1;
  const [r, g, b] = rgb.map((v) => { const s = v / 255; return s <= 0.03928 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4; });
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
};

const contrast = (a: string, b: string) => { const x = lum(a), y = lum(b); const [hi, lo] = x > y ? [x, y] : [y, x]; return (hi + 0.05) / (lo + 0.05); };
/** Black or white, whichever reads better on `bg` (button labels on a template's accent colour). */
const onColor = (bg: string) => (contrast("#ffffff", bg) >= contrast("#111111", bg) ? "#ffffff" : "#111111");
const toHex = (rgb: number[]) => "#" + rgb.map((v) => Math.round(Math.max(0, Math.min(255, v))).toString(16).padStart(2, "0")).join("");
/** The accent colour made readable as small text on `bg` (a pale yellow accent would be invisible on white). */
function readableAccent(accent: string, bg: string, min = 4.5): string {
  const a = hex(accent), b = hex(bg);
  if (!a || !b || contrast(accent, bg) >= min) return accent;
  const toward = lum(bg) > 0.5 ? [0, 0, 0] : [255, 255, 255];
  for (let t = 0.1; t <= 1.001; t += 0.1) {
    const mixed = toHex(a.map((v, i) => v + (toward[i] - v) * t));
    if (contrast(mixed, bg) >= min) return mixed;
  }
  return toHex(toward);
}

/** CSS variables the shared inner-page layout reads. Everything has a sensible fallback in globals.css. */
export function innerSkinVars(theme: TemplateTheme, templateName: string | null | undefined): Record<string, string> {
  const s = skinFor(templateName);
  const bg = s?.bg ?? theme.bg ?? "#ffffff";
  const ink = s?.ink ?? theme.ink ?? "#111111";
  const accent = s?.accent ?? theme.accent ?? "#1473ea";
  // A strong dark surface for the hero, call-to-action band and footer. On a dark template the page itself is that
  // surface; on a light one it is the template's own dark tone (or its ink).
  const dark = s?.dark ?? theme.surfaceDark ?? (lum(bg) < 0.25 ? bg : ink);
  const darkSafe = lum(dark) < 0.35 ? dark : ink;
  const radius = theme.radius || "10px";
  return {
    "--u-bg": bg,
    "--u-ink": ink,
    "--u-card": s ? "#ffffff" : theme.card || bg,
    "--u-accent": accent,
    "--u-on-accent": onColor(accent),
    "--u-accent-text": readableAccent(accent, bg),
    "--u-soft": theme.accentSoft || `color-mix(in srgb, ${accent} 14%, ${bg})`,
    "--u-muted": s ? `color-mix(in srgb, ${ink} 62%, ${bg})` : theme.muted || `color-mix(in srgb, ${ink} 62%, ${bg})`,
    "--u-line": s ? `color-mix(in srgb, ${ink} 12%, ${bg})` : theme.border || `color-mix(in srgb, ${ink} 14%, ${bg})`,
    "--u-dark": darkSafe,
    "--u-font": s?.font ?? theme.font ?? "inherit",
    "--u-head": s?.head ?? theme.headlineFont ?? theme.font ?? "inherit",
    "--u-radius": s?.card ?? radius,
    "--u-btn": s?.btn ?? radius,
  };
}
