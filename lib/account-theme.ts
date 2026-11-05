/** Theme variables for the customer account area: only the store's accent colour is used, surfaces stay neutral. */

const HEX = /^#?([0-9a-f]{3}|[0-9a-f]{6})$/i;

export function normalizeHex(value: unknown, fallback = "#111827"): string {
  const raw = typeof value === "string" ? value.trim() : "";
  const m = HEX.exec(raw);
  if (!m) return fallback;
  const h = m[1].length === 3 ? m[1].split("").map((c) => c + c).join("") : m[1];
  return `#${h.toLowerCase()}`;
}

/** Black or white, whichever reads better on this background (WCAG relative luminance). */
export function readableOn(hex: string): "#ffffff" | "#0f172a" {
  const h = normalizeHex(hex).slice(1);
  const [r, g, b] = [0, 2, 4].map((i) => {
    const c = parseInt(h.slice(i, i + 2), 16) / 255;
    return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
  });
  const lum = 0.2126 * r + 0.7152 * g + 0.0722 * b;
  return lum > 0.4 ? "#0f172a" : "#ffffff";
}

/** Very pale accents (white, cream) would vanish as text or a button: fall back to a dark neutral. */
export function accountAccent(themeColors: unknown): string {
  const colors = (themeColors && typeof themeColors === "object" ? themeColors : {}) as Record<string, unknown>;
  const accent = normalizeHex(colors.primary ?? colors.accent, "#111827");
  const h = accent.slice(1);
  const [r, g, b] = [0, 2, 4].map((i) => parseInt(h.slice(i, i + 2), 16) / 255);
  const lin = (c: number) => (c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4);
  const lum = 0.2126 * lin(r) + 0.7152 * lin(g) + 0.0722 * lin(b);
  return lum > 0.8 ? "#111827" : accent;
}

const lin = (c: number) => (c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4);
const lumOf = (rgb: number[]) => 0.2126 * lin(rgb[0] / 255) + 0.7152 * lin(rgb[1] / 255) + 0.0722 * lin(rgb[2] / 255);

/** The accent darkened just enough to read as text or an icon on white (contrast 4.5:1), for light brand colours. */
export function accentInk(accent: string): string {
  const h = normalizeHex(accent).slice(1);
  let rgb = [0, 2, 4].map((i) => parseInt(h.slice(i, i + 2), 16));
  for (let i = 0; i < 40 && 1.05 / (lumOf(rgb) + 0.05) < 4.5; i++) rgb = rgb.map((c) => Math.round(c * 0.92));
  return `#${rgb.map((c) => c.toString(16).padStart(2, "0")).join("")}`;
}

export function accountThemeStyle(themeColors: unknown, fontFamily?: string | null): Record<string, string> {
  const accent = accountAccent(themeColors);
  return {
    "--acx-accent": accent,
    "--acx-on-accent": readableOn(accent),
    "--acx-ink-accent": accentInk(accent),
    ...(fontFamily ? { "--acx-font": fontFamily } : {}),
  };
}
