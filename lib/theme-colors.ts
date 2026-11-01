/** Colours an owner can set on a template that draws its own homepage. Hex only, so every template can derive tints from them safely. */
export type TemplateColorInput = { accent?: string; background?: string };

const HEX = /^#[0-9a-f]{6}$/i;

/** Returns the cleaned colours, or an error message for the first invalid one. Blank values are dropped. */
export function normalizeTemplateColors(input: TemplateColorInput): { ok: true; value: { primary?: string; secondary?: string } } | { ok: false; error: string } {
  const value: { primary?: string; secondary?: string } = {};
  const accent = (input.accent ?? "").trim();
  const background = (input.background ?? "").trim();
  if (accent) {
    if (!HEX.test(accent)) return { ok: false, error: "Accent colour must be a hex colour like #0e5b45." };
    value.primary = accent.toLowerCase(); // resolveStoreTheme() reads primary as the template's accent
  }
  if (background) {
    if (!HEX.test(background)) return { ok: false, error: "Background colour must be a hex colour like #ffffff." };
    value.secondary = background.toLowerCase(); // ...and secondary as its page background
  }
  return { ok: true, value };
}
