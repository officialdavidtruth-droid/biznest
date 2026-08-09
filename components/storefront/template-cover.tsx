import type { TemplateTheme } from "@/lib/template-themes";

/**
 * A static, always-rendering "mini website" cover for a template card —
 * the same idea WordPress uses for its theme thumbnails (a scaled-down
 * facsimile of the real layout, not a screenshot pulled live off a running
 * site). It's built entirely from the template's own theme tokens (colors,
 * fonts, headline/sub/cta copy, hero style, layout), so it:
 *   - never depends on a seeded demo store existing,
 *   - never shows a 404 or a blank iframe,
 *   - always looks like *that* template, not a placeholder color swatch.
 *
 * This intentionally replaces the old approach of embedding a live
 * `/store/[slug]` iframe as the cover image, which only worked for the 3
 * templates with a seeded demo store — and broke (404) even for those once
 * the demo data wasn't present in a given environment.
 */
export function TemplateCover({ theme }: { theme: TemplateTheme }) {
  const isDark = isDarkColor(theme.bg);
  const mutedText = isDark ? "rgba(255,255,255,0.65)" : "rgba(0,0,0,0.55)";
  const chipBg = isDark ? "rgba(255,255,255,0.08)" : "rgba(0,0,0,0.05)";
  const cardBg = theme.card || (isDark ? "rgba(255,255,255,0.06)" : "#ffffff");

  return (
    <div
      className="flex h-full w-full flex-col overflow-hidden"
      style={{ background: theme.bg, color: theme.ink, fontFamily: theme.font }}
    >
      {/* Fake browser chrome so it reads as "a website", not a color card */}
      <div
        className="flex shrink-0 items-center gap-1 px-2 py-1"
        style={{ background: chipBg }}
      >
        <span className="h-1.5 w-1.5 rounded-full" style={{ background: mutedText, opacity: 0.5 }} />
        <span className="h-1.5 w-1.5 rounded-full" style={{ background: mutedText, opacity: 0.5 }} />
        <span className="h-1.5 w-1.5 rounded-full" style={{ background: mutedText, opacity: 0.5 }} />
        <span
          className="ml-1.5 h-2.5 flex-1 rounded-sm"
          style={{ background: isDark ? "rgba(255,255,255,0.08)" : "rgba(0,0,0,0.06)", maxWidth: "60%" }}
        />
      </div>

      {/* Nav row */}
      <div className="flex shrink-0 items-center justify-between px-3 py-1.5">
        <span
          className="truncate text-[7px] font-bold uppercase tracking-wide"
          style={{ fontFamily: theme.headlineFont, maxWidth: "55%" }}
        >
          {theme.eyebrow}
        </span>
        <div className="flex items-center gap-1">
          <span className="h-1 w-4 rounded-full" style={{ background: mutedText, opacity: 0.4 }} />
          <span className="h-1 w-4 rounded-full" style={{ background: mutedText, opacity: 0.4 }} />
          <span
            className="rounded-full px-1.5 py-0.5 text-[6px] font-bold"
            style={{ background: theme.accent, color: bestTextOn(theme.accent) }}
          >
            {theme.cta}
          </span>
        </div>
      </div>

      {/* Hero */}
      <div className="flex flex-1 flex-col justify-center overflow-hidden px-3 pb-1.5">
        {theme.heroStyle === "split" ? (
          <div className="flex h-full items-center gap-2">
            <div className="flex-1">
              <span
                className="mb-1 inline-block rounded px-1 py-0.5 text-[6px] font-bold uppercase"
                style={{ color: theme.accent, border: `1px solid ${theme.accent}` }}
              >
                {theme.eyebrow}
              </span>
              <p
                className="text-[9px] font-bold leading-tight"
                style={{ fontFamily: theme.headlineFont }}
              >
                {theme.headline}
              </p>
              <span
                className="mt-1 inline-block rounded-full px-1.5 py-0.5 text-[6px] font-bold"
                style={{ background: theme.accent, color: bestTextOn(theme.accent) }}
              >
                {theme.cta}
              </span>
            </div>
            <div
              className="h-full flex-1 rounded"
              style={{ background: mix(theme.accent, theme.bg, 0.75), minHeight: 40 }}
            />
          </div>
        ) : theme.heroStyle === "fullbleed" ? (
          <div
            className="relative flex h-full flex-col justify-end overflow-hidden rounded p-2"
            style={{ background: mix(theme.accent, theme.ink, 0.82) }}
          >
            <span
              className="mb-1 w-fit rounded px-1 py-0.5 text-[6px] font-bold uppercase"
              style={{ color: theme.accent, border: `1px solid ${theme.accent}` }}
            >
              {theme.eyebrow}
            </span>
            <p
              className="text-[9px] font-bold leading-tight text-white"
              style={{ fontFamily: theme.headlineFont }}
            >
              {theme.headline}
            </p>
          </div>
        ) : (
          <div className="flex h-full flex-col items-center justify-center text-center">
            <span
              className="mb-1 w-fit rounded px-1 py-0.5 text-[6px] font-bold uppercase"
              style={{ color: theme.accent, border: `1px solid ${theme.accent}` }}
            >
              {theme.eyebrow}
            </span>
            <p
              className="text-[9px] font-bold leading-tight"
              style={{ fontFamily: theme.headlineFont }}
            >
              {theme.headline}
            </p>
            <span
              className="mt-1 inline-block rounded-full px-1.5 py-0.5 text-[6px] font-bold"
              style={{ background: theme.accent, color: bestTextOn(theme.accent) }}
            >
              {theme.cta}
            </span>
          </div>
        )}
      </div>

      {/* Catalog strip so the layout ("grid" vs "list") reads clearly too */}
      <div className="shrink-0 px-3 pb-2">
        {theme.layout === "list" ? (
          <div className="flex flex-col gap-1">
            {[0, 1].map((i) => (
              <div
                key={i}
                className="flex items-center gap-1 rounded px-1 py-1"
                style={{ background: cardBg, border: `1px solid ${chipBg}` }}
              >
                <span className="h-3 w-3 shrink-0 rounded" style={{ background: mix(theme.accent, theme.bg, 0.7) }} />
                <span className="h-1 flex-1 rounded-full" style={{ background: mutedText, opacity: 0.35 }} />
              </div>
            ))}
          </div>
        ) : (
          <div className="grid grid-cols-3 gap-1">
            {[0, 1, 2].map((i) => (
              <div
                key={i}
                className="aspect-square rounded"
                style={{
                  background: i === 1 ? mix(theme.accent, theme.bg, 0.6) : cardBg,
                  border: `1px solid ${chipBg}`,
                }}
              />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

function hexToRgb(hex: string): [number, number, number] | null {
  const m = hex.trim().match(/^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i);
  if (!m) return null;
  return [parseInt(m[1], 16), parseInt(m[2], 16), parseInt(m[3], 16)];
}

function isDarkColor(hex: string): boolean {
  const rgb = hexToRgb(hex);
  if (!rgb) return false;
  const [r, g, b] = rgb;
  return (r * 299 + g * 587 + b * 114) / 1000 < 140;
}

function bestTextOn(hex: string): string {
  return isDarkColor(hex) ? "#ffffff" : "#111111";
}

/** Blend `hex` toward `toward` by `amount` (0 = hex, 1 = toward). Falls back
 * gracefully to `hex` if either value isn't a plain #rrggbb color. */
function mix(hex: string, toward: string, amount: number): string {
  const a = hexToRgb(hex);
  const b = hexToRgb(toward);
  if (!a || !b) return hex;
  const r = Math.round(a[0] + (b[0] - a[0]) * amount);
  const g = Math.round(a[1] + (b[1] - a[1]) * amount);
  const bl = Math.round(a[2] + (b[2] - a[2]) * amount);
  return `rgb(${r}, ${g}, ${bl})`;
}
