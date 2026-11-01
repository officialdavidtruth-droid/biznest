/**
 * Keeps storefront text readable. Owners can pick page and accent colours freely, and a dark background
 * combined with the template's dark text gave pages where the menu, labels and prices could not be read.
 * Colours that already have enough contrast are left exactly as they are.
 */
type Rgb = [number, number, number];

function parseHex(value: unknown): Rgb | null {
  if (typeof value !== "string") return null;
  const m = value.trim().match(/^#([0-9a-f]{3}|[0-9a-f]{6})$/i);
  if (!m) return null;
  const h = m[1].length === 3 ? m[1].split("").map((c) => c + c).join("") : m[1];
  return [parseInt(h.slice(0, 2), 16), parseInt(h.slice(2, 4), 16), parseInt(h.slice(4, 6), 16)];
}

const toHex = ([r, g, b]: Rgb) => `#${[r, g, b].map((v) => Math.max(0, Math.min(255, Math.round(v))).toString(16).padStart(2, "0")).join("")}`;

function luminance([r, g, b]: Rgb): number {
  const f = (v: number) => { const c = v / 255; return c <= 0.03928 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4); };
  return 0.2126 * f(r) + 0.7152 * f(g) + 0.0722 * f(b);
}

export function contrastRatio(a: string, b: string): number {
  const x = parseHex(a), y = parseHex(b);
  if (!x || !y) return 21;
  const [hi, lo] = [luminance(x), luminance(y)].sort((p, q) => q - p);
  return (hi + 0.05) / (lo + 0.05);
}

export const isDarkColor = (color: string) => { const c = parseHex(color); return c ? luminance(c) < 0.18 : false; };

/** White or near-black text, whichever reads better on `bg`. */
export function readableOn(bg: string): string {
  return contrastRatio("#ffffff", bg) >= contrastRatio("#111111", bg) ? "#ffffff" : "#111111";
}

export function mix(a: string, b: string, t: number): string {
  const x = parseHex(a), y = parseHex(b);
  if (!x || !y) return a;
  return toHex([x[0] + (y[0] - x[0]) * t, x[1] + (y[1] - x[1]) * t, x[2] + (y[2] - x[2]) * t]);
}

type Tokens = { background: string; surface: string; text: string; muted: string; accent: string; primary: string };

export function ensureReadableDesign<T extends Tokens>(design: T): T {
  const bg = design.background;
  if (!parseHex(bg)) return design;
  const dark = isDarkColor(bg);
  const out = { ...design };
  if (contrastRatio(out.text, bg) < 4.5) out.text = dark ? "#f4f6f3" : "#14181a";
  if (contrastRatio(out.muted, bg) < 4.5) out.muted = dark ? mix(bg, "#ffffff", 0.78) : mix(bg, "#000000", 0.72);
  if (!parseHex(out.surface) || contrastRatio(out.text, out.surface) < 4.5) out.surface = dark ? mix(bg, "#ffffff", 0.09) : mix(bg, "#ffffff", 0.6);
  if (contrastRatio(out.accent, bg) < 3) out.accent = dark ? "#ffc247" : mix(out.primary, "#000000", 0.25);
  return out;
}

/**
 * Text, secondary text, card and border colours that stay readable on an owner-chosen page background. Anything the
 * owner set explicitly (`set`) is kept unless it cannot be read, in which case the readable fallback is used.
 */
export function deriveReadableTheme(
  bg: string,
  current: { ink: string; muted?: string; card: string; border?: string },
  set: { ink?: boolean; card?: boolean; muted?: boolean; border?: boolean } = {},
): { ink: string; muted: string; card: string; border: string } {
  if (!parseHex(bg)) return { ink: current.ink, muted: current.muted ?? current.ink, card: current.card, border: current.border ?? `${current.ink}22` };
  const dark = isDarkColor(bg);
  const ink = contrastRatio(current.ink, bg) >= 4.5 ? current.ink : dark ? "#f4f6f3" : "#14181a";
  const mutedGiven = current.muted && parseHex(current.muted) ? current.muted : "";
  const muted = mutedGiven && contrastRatio(mutedGiven, bg) >= 4.5 ? mutedGiven : dark ? mix(bg, "#ffffff", 0.78) : mix(bg, "#000000", 0.72);
  const cardOk = parseHex(current.card) && contrastRatio(ink, current.card) >= 4.5;
  const card = set.card && cardOk ? current.card : cardOk && !isDarkColor(current.card) === !dark ? current.card : dark ? mix(bg, "#ffffff", 0.09) : mix(bg, "#ffffff", 0.6);
  const borderGiven = current.border && parseHex(current.border) ? current.border : "";
  const border = set.border && borderGiven ? borderGiven : dark ? mix(bg, "#ffffff", 0.18) : mix(bg, "#000000", 0.12);
  return { ink, muted, card, border };
}
