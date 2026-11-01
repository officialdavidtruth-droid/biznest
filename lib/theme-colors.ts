/**
 * Colours and type settings an owner can set on a template that draws its own homepage. Colours are hex only, so every
 * template can derive tints from them safely. Blank values are dropped (the template's own value is used).
 */
export type TemplateColorInput = {
  accent?: string; background?: string; text?: string; card?: string; muted?: string; border?: string; header?: string;
  headingFont?: string; bodyFont?: string; radius?: number | string;
  buttonStyle?: string; containerWidth?: string;
};

export type TemplateColorValue = {
  primary?: string; secondary?: string; ink?: string; card?: string; muted?: string; border?: string; surfaceDark?: string;
  headlineFont?: string; font?: string; radius?: string;
  buttonStyle?: "solid" | "outline" | "pill"; containerWidth?: "compact" | "standard" | "wide";
};

const HEX = /^#[0-9a-f]{6}$/i;
/** Font names go into a CSS font stack, so only plain family names are accepted. */
const FONT = /^[A-Za-z0-9][A-Za-z0-9 \-]{0,48}$/;

const COLOR_FIELDS: { key: keyof TemplateColorInput; out: keyof TemplateColorValue; label: string }[] = [
  { key: "accent", out: "primary", label: "Accent colour" },
  { key: "background", out: "secondary", label: "Background colour" },
  { key: "text", out: "ink", label: "Text colour" },
  { key: "card", out: "card", label: "Card colour" },
  { key: "muted", out: "muted", label: "Secondary text colour" },
  { key: "border", out: "border", label: "Line colour" },
  { key: "header", out: "surfaceDark", label: "Header and footer colour" },
];

/** Returns the cleaned settings, or an error message for the first invalid one. */
export function normalizeTemplateColors(input: TemplateColorInput): { ok: true; value: TemplateColorValue } | { ok: false; error: string } {
  const value: TemplateColorValue = {};
  for (const f of COLOR_FIELDS) {
    const raw = String(input[f.key] ?? "").trim();
    if (!raw) continue;
    if (!HEX.test(raw)) return { ok: false, error: `${f.label} must be a hex colour like #0e5b45.` };
    (value as Record<string, string>)[f.out] = raw.toLowerCase();
  }
  for (const [key, out, label] of [["headingFont", "headlineFont", "Heading font"], ["bodyFont", "font", "Body font"]] as const) {
    const raw = String(input[key] ?? "").trim();
    if (!raw) continue;
    if (!FONT.test(raw)) return { ok: false, error: `${label} must be a plain font name like Poppins.` };
    value[out] = `'${raw}', sans-serif`;
  }
  if (input.radius !== undefined && input.radius !== "") {
    const n = Number(input.radius);
    if (!Number.isFinite(n) || n < 0 || n > 40) return { ok: false, error: "Corner roundness must be between 0 and 40." };
    value.radius = `${Math.round(n)}px`;
  }
  const bs = String(input.buttonStyle ?? "").trim();
  if (bs) {
    if (bs !== "solid" && bs !== "outline" && bs !== "pill") return { ok: false, error: "Button style must be solid, outline or pill." };
    value.buttonStyle = bs;
  }
  const cw = String(input.containerWidth ?? "").trim();
  if (cw) {
    if (cw !== "compact" && cw !== "standard" && cw !== "wide") return { ok: false, error: "Page width must be compact, standard or wide." };
    value.containerWidth = cw;
  }
  return { ok: true, value };
}
