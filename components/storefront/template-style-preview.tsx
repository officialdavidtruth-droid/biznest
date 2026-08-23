import type { TemplateTheme } from "@/lib/template-themes";

/**
 * Full-size "style preview" for a template — shown in the Template Gallery
 * modal for every template that doesn't have a seeded live demo store (see
 * components/dashboard/template-gallery.tsx and lib/demo-stores.ts).
 *
 * Like TemplateCover, this is built entirely from the template's own theme
 * tokens (colors, fonts, headline/sub/cta copy, hero style, layout) rather
 * than an iframe into a real store, so it always renders — never a blank or
 * 404'd preview — for every template in the catalog, seeded demo or not.
 */
export function TemplateStylePreview({
  theme,
  storeName,
}: {
  theme: TemplateTheme;
  storeName: string;
}) {
  const isDark = isDarkColor(theme.bg);
  const mutedText = theme.muted ?? (isDark ? "rgba(255,255,255,0.65)" : "rgba(0,0,0,0.55)");
  const borderColor = theme.border ?? (isDark ? "rgba(255,255,255,0.12)" : "rgba(0,0,0,0.08)");
  const cardBg = theme.card || (isDark ? "rgba(255,255,255,0.06)" : "#ffffff");
  const surfaceDark = theme.surfaceDark ?? theme.ink;
  const textOnAccent = bestTextOn(theme.accent);
  const catalogItems = Array.from({ length: theme.layout === "list" ? 4 : 6 });

  return (
    <div style={{ background: theme.bg, color: theme.ink, fontFamily: theme.font }}>
      {/* Nav */}
      <div
        className="flex items-center justify-between px-6 py-4 sm:px-10"
        style={{ borderBottom: `1px solid ${borderColor}` }}
      >
        <span
          className="text-base font-bold tracking-tight sm:text-lg"
          style={{ fontFamily: theme.headlineFont }}
        >
          {storeName}
        </span>
        <div className="hidden items-center gap-6 text-sm sm:flex" style={{ color: mutedText }}>
          <span>{theme.catalogLabel}</span>
          <span>About</span>
          <span>Contact</span>
        </div>
        <span
          className="rounded-full px-4 py-1.5 text-xs font-semibold"
          style={{ background: theme.accent, color: textOnAccent }}
        >
          {theme.cta}
        </span>
      </div>

      {/* Hero */}
      {theme.heroStyle === "split" ? (
        <div className="grid grid-cols-1 items-center gap-8 px-6 py-14 sm:grid-cols-2 sm:px-10 sm:py-20">
          <div>
            <span
              className="mb-3 inline-block rounded-full px-3 py-1 text-[11px] font-bold uppercase tracking-wide"
              style={{ color: theme.accent, border: `1px solid ${theme.accent}` }}
            >
              {theme.eyebrow}
            </span>
            <h1
              className="text-3xl font-bold leading-tight sm:text-4xl"
              style={{ fontFamily: theme.headlineFont }}
            >
              {theme.headline}
            </h1>
            <p className="mt-4 max-w-md text-sm leading-relaxed" style={{ color: mutedText }}>
              {theme.sub}
            </p>
            <span
              className="mt-6 inline-block rounded-full px-5 py-2.5 text-sm font-semibold"
              style={{ background: theme.accent, color: textOnAccent }}
            >
              {theme.cta}
            </span>
          </div>
          <div
            className="aspect-[4/3] w-full rounded-2xl"
            style={{ background: mix(theme.accent, theme.bg, 0.75) }}
          />
        </div>
      ) : theme.heroStyle === "fullbleed" ? (
        <div
          className="relative flex min-h-[22rem] flex-col justify-end overflow-hidden px-6 py-14 sm:px-10 sm:py-20"
          style={{ background: mix(theme.accent, surfaceDark, 0.82) }}
        >
          <span
            className="mb-3 inline-block w-fit rounded-full px-3 py-1 text-[11px] font-bold uppercase tracking-wide"
            style={{ color: theme.accent, border: `1px solid ${theme.accent}` }}
          >
            {theme.eyebrow}
          </span>
          <h1
            className="max-w-2xl text-3xl font-bold leading-tight text-white sm:text-4xl"
            style={{ fontFamily: theme.headlineFont }}
          >
            {theme.headline}
          </h1>
          <p className="mt-4 max-w-md text-sm leading-relaxed text-white/75">{theme.sub}</p>
          <span
            className="mt-6 inline-block w-fit rounded-full px-5 py-2.5 text-sm font-semibold"
            style={{ background: theme.accent, color: textOnAccent }}
          >
            {theme.cta}
          </span>
        </div>
      ) : (
        <div className="flex flex-col items-center px-6 py-16 text-center sm:px-10 sm:py-24">
          <span
            className="mb-3 inline-block rounded-full px-3 py-1 text-[11px] font-bold uppercase tracking-wide"
            style={{ color: theme.accent, border: `1px solid ${theme.accent}` }}
          >
            {theme.eyebrow}
          </span>
          <h1
            className="max-w-xl text-3xl font-bold leading-tight sm:text-4xl"
            style={{ fontFamily: theme.headlineFont }}
          >
            {theme.headline}
          </h1>
          <p className="mt-4 max-w-md text-sm leading-relaxed" style={{ color: mutedText }}>
            {theme.sub}
          </p>
          <span
            className="mt-6 inline-block rounded-full px-5 py-2.5 text-sm font-semibold"
            style={{ background: theme.accent, color: textOnAccent }}
          >
            {theme.cta}
          </span>
        </div>
      )}

      {/* Catalog */}
      <div className="px-6 py-12 sm:px-10 sm:py-16" style={{ borderTop: `1px solid ${borderColor}` }}>
        <div className="mb-6 flex items-center justify-between">
          <h2 className="text-lg font-bold sm:text-xl" style={{ fontFamily: theme.headlineFont }}>
            {theme.catalogLabel}
          </h2>
          <span className="text-xs font-medium" style={{ color: theme.accent }}>
            View all
          </span>
        </div>

        {theme.layout === "list" ? (
          <div className="flex flex-col gap-3">
            {catalogItems.map((_, i) => (
              <div
                key={i}
                className="flex items-center gap-4 rounded-xl p-3"
                style={{ background: cardBg, border: `1px solid ${borderColor}` }}
              >
                <div
                  className="h-16 w-16 shrink-0 rounded-lg"
                  style={{ background: mix(theme.accent, theme.bg, i % 2 === 0 ? 0.6 : 0.75) }}
                />
                <div className="min-w-0 flex-1">
                  <div className="h-2.5 w-2/3 rounded-full" style={{ background: mutedText, opacity: 0.3 }} />
                  <div className="mt-2 h-2 w-1/3 rounded-full" style={{ background: mutedText, opacity: 0.2 }} />
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className="grid grid-cols-2 gap-4 sm:grid-cols-3">
            {catalogItems.map((_, i) => (
              <div
                key={i}
                className="overflow-hidden rounded-xl"
                style={{ background: cardBg, border: `1px solid ${borderColor}` }}
              >
                <div
                  className="aspect-square"
                  style={{ background: mix(theme.accent, theme.bg, i % 3 === 1 ? 0.55 : 0.72) }}
                />
                <div className="space-y-2 p-3">
                  <div className="h-2.5 w-4/5 rounded-full" style={{ background: mutedText, opacity: 0.3 }} />
                  <div className="h-2 w-1/2 rounded-full" style={{ background: mutedText, opacity: 0.2 }} />
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Footer */}
      <div
        className="flex flex-col items-center gap-2 px-6 py-10 text-center sm:px-10"
        style={{ background: surfaceDark, color: "rgba(255,255,255,0.7)" }}
      >
        <span className="text-sm font-bold text-white" style={{ fontFamily: theme.headlineFont }}>
          {storeName}
        </span>
        <p className="text-xs">Built with Biznest</p>
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
