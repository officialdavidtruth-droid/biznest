import { readableAccentText } from "@/lib/utils/readable-accent";
import type React from "react";
import { cssUrl, safeHref } from "@/lib/builder-safe";
import type { BuilderConfig, BuilderSection, HeroVariant } from "@/lib/builder-config";
import { formatNumber } from "@/lib/i18n/locale";

/**
 * Signature hero compositions for the Builder.
 *
 * `heroStyle` (split / centered / fullbleed) only says where the text sits. A `heroVariant`
 * is a whole composition of its own, so two templates that both "have a full-bleed hero"
 * no longer look the same above the fold. Each template is assigned exactly one variant in
 * lib/template-themes.ts (HERO_VARIANT_BY_MODE / NAMED_TEMPLATE_IDENTITY), and
 * lib/__tests__/template-uniqueness.test.ts keeps header + variant unique per template.
 */
type D = BuilderConfig["design"];
export type HeroItem = { id: string; name: string; price: number; currency: string; image: string | null; categoryName: string | null };
type Props = { section: BuilderSection; d: D; items: HeroItem[]; categories: string[]; slug?: string };

function lum(hex: string): number {
  const m = hex.trim().match(/^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})/i);
  if (!m) return 0.5;
  return (parseInt(m[1], 16) * 299 + parseInt(m[2], 16) * 587 + parseInt(m[3], 16) * 114) / 255000;
}
const on = (bg: string, light = "#fff", dark = "#111") => (lum(bg) < 0.55 ? light : dark);
const bgImg = (src: string | undefined | null, fallback: string): React.CSSProperties => ({ background: src ? `url(${cssUrl(src)}) center/cover` : fallback });

function Cta({ s, d, bg, fg, kind = "solid" }: { s: BuilderSection["settings"]; d: D; bg: string; fg: string; kind?: "solid" | "link" }) {
  if (s.showButton === false || !s.ctaLabel) return null;
  const common: React.CSSProperties = { display: "inline-block", fontWeight: 800, fontSize: 14 };
  if (kind === "link") return <a href={safeHref(s.ctaHref, "#catalog")} style={{ ...common, color: fg, borderBottom: `2px solid ${bg}`, paddingBottom: 4 }}>{s.ctaLabel}</a>;
  return <a href={safeHref(s.ctaHref, "#catalog")} style={{ ...common, padding: "14px 24px", background: bg, color: fg, borderRadius: d.buttonStyle === "pill" ? 999 : Math.min(d.radius, 14) }}>{s.ctaLabel}</a>;
}

const money = (i: HeroItem) => `${i.currency} ${formatNumber(i.price)}`;

/** Product tiles for variants that show the catalogue; falls back to tinted blocks so empty stores still look designed. */
function Tile({ item, d, ratio, r }: { item?: HeroItem; d: D; ratio: string; r: number }) {
  return (
    <div style={{ position: "relative", aspectRatio: ratio, borderRadius: r, overflow: "hidden", ...bgImg(item?.image, `linear-gradient(135deg, ${d.accent}33, ${d.primary}22)`) }}>
      {item && (
        <div style={{ position: "absolute", left: 10, right: 10, bottom: 10, background: `${d.background}ee`, color: d.text, borderRadius: Math.min(r, 10), padding: "8px 10px", display: "flex", flexWrap: "wrap", justifyContent: "space-between", alignItems: "baseline", columnGap: 8, rowGap: 2, fontSize: 12, fontWeight: 700 }}>
          <span style={{ flex: "1 1 60px", minWidth: 0, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{item.name}</span><span style={{ whiteSpace: "nowrap", color: readableAccentText(d.accent, d.background) }}>{money(item)}</span>
        </div>
      )}
    </div>
  );
}

export function HeroVariantView({ variant, section, d, items, categories, slug }: Props & { variant: HeroVariant }) {
  const s = section.settings;
  const heading = s.heading || "Welcome";
  const r = s.radius ?? d.radius;
  const wrap = "bn-wrap bn-hero";
  const id = section.id;

  switch (variant) {
    /* Marketplace hero: a rounded brand panel with a big product photo, two floating product cards and category chips. Retail, grocery, markets. */
    case "banner": {
      const bg = d.accent, fg = on(bg);
      const withImg = items.filter((i) => i.image);
      const hero = withImg[0], second = withImg[1], third = withImg[2];
      return (
        <section id={id} data-bn-type="hero" className="bn-section" style={{ padding: "28px 0 8px", background: d.background }}>
          <div className="bn-wrap">
            <div className="bn-hero" style={{ position: "relative", overflow: "hidden", display: "grid", gridTemplateColumns: "1.1fr .9fr", gap: 32, alignItems: "center", padding: "clamp(28px,5vw,64px)", borderRadius: Math.max(r + 10, 24), color: fg, background: `radial-gradient(90% 120% at 100% 0%, ${d.primary}66 0%, transparent 60%), ${bg}` }}>
              <div>
                {s.eyebrow && <span style={{ display: "inline-block", background: `${fg}22`, borderRadius: 999, padding: "6px 14px", fontWeight: 700, fontSize: 13, marginBottom: 18 }}>{s.eyebrow}</span>}
                <h1 style={{ fontFamily: d.headingFont, fontWeight: 900, fontSize: "clamp(38px,5.4vw,74px)", lineHeight: 1, letterSpacing: "-.035em", margin: 0 }}>{heading}</h1>
                {s.body && <p style={{ opacity: 0.88, lineHeight: 1.65, maxWidth: 460, margin: "18px 0 26px" }}>{s.body}</p>}
                <div style={{ display: "flex", flexWrap: "wrap", gap: 12, alignItems: "center" }}>
                  <Cta s={s} d={d} bg={fg} fg={bg} />
                </div>
                {categories.length > 0 && <div style={{ display: "flex", flexWrap: "wrap", gap: 8, marginTop: 28 }}>{categories.slice(0, 4).map((c) => <span key={c} style={{ padding: "6px 14px", borderRadius: 999, background: `${fg}1f`, fontSize: 13, fontWeight: 700 }}>{c}</span>)}</div>}
              </div>
              <div style={{ position: "relative", justifySelf: "center", width: "100%", maxWidth: 440 }}>
                <div style={{ aspectRatio: "1/1", borderRadius: Math.max(r + 6, 20), boxShadow: "0 28px 60px -20px rgba(0,0,0,.45)", ...bgImg(s.image || hero?.image, `linear-gradient(135deg, ${d.primary}33, ${d.accent}55)`) }} />
                {hero && <div style={{ position: "absolute", left: -18, bottom: 22, background: "#fff", color: "#111", borderRadius: 16, padding: "10px 14px", boxShadow: "0 14px 30px rgba(0,0,0,.2)", fontSize: 13, fontWeight: 800, maxWidth: 190 }}><div style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{hero.name}</div><div style={{ color: readableAccentText(d.accent, "#ffffff") }}>{money(hero)}</div></div>}
                {second && <div aria-hidden style={{ position: "absolute", right: -14, top: 18, width: "30%", aspectRatio: "1/1", borderRadius: 18, border: "4px solid #fff", boxShadow: "0 14px 30px rgba(0,0,0,.25)", ...bgImg(second.image, d.accent) }} />}
                {third && <div aria-hidden style={{ position: "absolute", right: 10, bottom: -16, width: "24%", aspectRatio: "1/1", borderRadius: 16, border: "4px solid #fff", boxShadow: "0 14px 30px rgba(0,0,0,.25)", ...bgImg(third.image, d.accent) }} />}
              </div>
            </div>
          </div>
        </section>
      );
    }

    /* Light and airy split: left-aligned text, a large rounded photo with a floating price card, soft tinted panel. Electronics, wellness, minimal brands. */
    case "quiet": {
      const hero = items.find((i) => i.image);
      return (
        <section id={id} data-bn-type="hero" className="bn-section" style={{ background: `linear-gradient(180deg, ${d.accent}14, ${d.background})`, padding: "64px 0 48px" }}>
          <div className={wrap} style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 48, alignItems: "center" }}>
            <div>
              {s.eyebrow && <span style={{ display: "inline-block", background: `${d.accent}22`, color: readableAccentText(d.accent, d.background), borderRadius: 999, padding: "6px 14px", fontWeight: 700, fontSize: 13, marginBottom: 18 }}>{s.eyebrow}</span>}
              <h1 style={{ fontFamily: d.headingFont, fontWeight: 700, fontSize: "clamp(36px,5vw,64px)", lineHeight: 1.05, letterSpacing: "-.03em", margin: 0 }}>{heading}</h1>
              {s.body && <p style={{ color: d.muted, lineHeight: 1.75, maxWidth: 480, margin: "20px 0 28px" }}>{s.body}</p>}
              <div style={{ display: "flex", flexWrap: "wrap", gap: 12, alignItems: "center" }}>
                <Cta s={s} d={d} bg={d.accent} fg={on(d.accent)} />
              </div>
            </div>
            <div style={{ position: "relative" }}>
              <div style={{ aspectRatio: "5/4", borderRadius: Math.max(r + 8, 20), boxShadow: `0 30px 60px -28px ${d.text}66`, ...bgImg(s.image || hero?.image, `linear-gradient(135deg, ${d.accent}22, ${d.accent}55)`) }} />
              {hero && <div style={{ position: "absolute", left: 18, bottom: 18, background: d.background, borderRadius: 14, padding: "10px 14px", boxShadow: `0 12px 28px ${d.text}33`, fontSize: 13, fontWeight: 800 }}><div style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", maxWidth: 200 }}>{hero.name}</div><div style={{ color: readableAccentText(d.accent, d.background) }}>{money(hero)}</div></div>}
            </div>
          </div>
        </section>
      );
    }
  }
}
