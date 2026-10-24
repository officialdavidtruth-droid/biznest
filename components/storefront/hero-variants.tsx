import type React from "react";
import type { BuilderConfig, BuilderSection, HeroVariant } from "@/lib/builder-config";

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
type Props = { section: BuilderSection; d: D; items: HeroItem[]; categories: string[] };

function lum(hex: string): number {
  const m = hex.trim().match(/^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})/i);
  if (!m) return 0.5;
  return (parseInt(m[1], 16) * 299 + parseInt(m[2], 16) * 587 + parseInt(m[3], 16) * 114) / 255000;
}
const on = (bg: string, light = "#fff", dark = "#111") => (lum(bg) < 0.55 ? light : dark);
const bgImg = (src: string | undefined | null, fallback: string): React.CSSProperties => ({ background: src ? `url(${src}) center/cover` : fallback });

function Cta({ s, d, bg, fg, kind = "solid" }: { s: BuilderSection["settings"]; d: D; bg: string; fg: string; kind?: "solid" | "link" }) {
  if (s.showButton === false || !s.ctaLabel) return null;
  const common: React.CSSProperties = { display: "inline-block", fontWeight: 800, fontSize: 14 };
  if (kind === "link") return <a href={s.ctaHref || "#catalog"} style={{ ...common, color: fg, borderBottom: `2px solid ${bg}`, paddingBottom: 4 }}>{s.ctaLabel}</a>;
  return <a href={s.ctaHref || "#catalog"} style={{ ...common, padding: "14px 24px", background: bg, color: fg, borderRadius: d.buttonStyle === "pill" ? 999 : Math.min(d.radius, 14) }}>{s.ctaLabel}</a>;
}

const money = (i: HeroItem) => `${i.currency} ${i.price.toLocaleString()}`;

/** Product tiles for variants that show the catalogue; falls back to tinted blocks so empty stores still look designed. */
function Tile({ item, d, ratio, r }: { item?: HeroItem; d: D; ratio: string; r: number }) {
  return (
    <div style={{ position: "relative", aspectRatio: ratio, borderRadius: r, overflow: "hidden", ...bgImg(item?.image, `linear-gradient(135deg, ${d.accent}33, ${d.primary}22)`) }}>
      {item && (
        <div style={{ position: "absolute", left: 10, right: 10, bottom: 10, background: `${d.background}ee`, color: d.text, borderRadius: Math.min(r, 10), padding: "8px 10px", display: "flex", justifyContent: "space-between", gap: 8, fontSize: 12, fontWeight: 700 }}>
          <span style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{item.name}</span><span style={{ whiteSpace: "nowrap", color: d.accent }}>{money(item)}</span>
        </div>
      )}
    </div>
  );
}

export function HeroVariantView({ variant, section, d, items, categories }: Props & { variant: HeroVariant }) {
  const s = section.settings;
  const heading = s.heading || "Welcome";
  const r = s.radius ?? d.radius;
  const wrap = "bn-wrap bn-hero";
  const id = section.id;

  switch (variant) {
    /* Oversized type on a dark field with an accent slab cutting in from the right. Drops, sport, streetwear. */
    case "poster": {
      const bg = d.primary, fg = on(bg);
      return (
        <section id={id} className="bn-section" style={{ position: "relative", overflow: "hidden", background: bg, color: fg, padding: "88px 0 0" }}>
          <div aria-hidden style={{ position: "absolute", top: 0, right: 0, bottom: 0, width: "44%", clipPath: "polygon(22% 0,100% 0,100% 100%,0 100%)", ...bgImg(s.image, d.accent), opacity: s.image ? 0.9 : 1 }} />
          <div className="bn-wrap" style={{ position: "relative" }}>
            {s.eyebrow && <span style={{ display: "inline-block", background: d.accent, color: on(d.accent), fontWeight: 900, fontSize: 12, padding: "6px 12px", borderRadius: 2, marginBottom: 22 }}>{s.eyebrow}</span>}
            <h1 style={{ fontFamily: d.headingFont, fontWeight: 900, fontSize: "clamp(56px,13vw,176px)", lineHeight: 0.86, letterSpacing: "-.055em", margin: 0, maxWidth: "11ch", textTransform: "uppercase" }}>{heading}</h1>
            <div style={{ marginTop: 56, borderTop: `2px solid ${d.accent}`, padding: "22px 0 30px", display: "flex", justifyContent: "space-between", alignItems: "center", gap: 20, flexWrap: "wrap" }}>
              {s.body && <p style={{ margin: 0, maxWidth: 460, lineHeight: 1.6, opacity: 0.82 }}>{s.body}</p>}
              <Cta s={s} d={d} bg={d.accent} fg={on(d.accent)} />
            </div>
          </div>
        </section>
      );
    }

    /* Two columns: quiet text column, tall image with a smaller inset image. Fashion label. */
    case "editorial": {
      const inset = items.find((i) => i.image);
      return (
        <section id={id} className="bn-section" style={{ background: d.background, padding: "64px 0 80px" }}>
          <div className={wrap} style={{ display: "grid", gridTemplateColumns: "1fr 1.05fr", gap: 64, alignItems: "end" }}>
            <div style={{ paddingBottom: 12 }}>
              {s.eyebrow && <p style={{ margin: "0 0 26px", color: d.muted, fontStyle: "italic", fontFamily: d.headingFont, fontSize: 18 }}>{s.eyebrow}</p>}
              <h1 style={{ fontFamily: d.headingFont, fontWeight: 400, fontSize: "clamp(44px,7vw,108px)", lineHeight: 0.98, letterSpacing: "-.03em", margin: 0, color: d.text }}>{heading}</h1>
              {s.body && <p style={{ color: d.muted, lineHeight: 1.8, maxWidth: 420, margin: "32px 0" }}>{s.body}</p>}
              <Cta s={s} d={d} bg={d.text} fg={d.text} kind="link" />
            </div>
            <div style={{ position: "relative" }}>
              <div style={{ aspectRatio: "4/5", borderRadius: r, ...bgImg(s.image, `linear-gradient(160deg, ${d.accent}55, ${d.primary}33)`) }} />
              <div style={{ position: "absolute", left: -48, bottom: 40, width: "34%", aspectRatio: "3/4", borderRadius: r, border: `8px solid ${d.background}`, ...bgImg(inset?.image, `${d.accent}66`) }} />
            </div>
          </div>
        </section>
      );
    }

    /* Centred headline over a row of three staggered panels. Boutique / seasonal collections. */
    case "lookbook": {
      const panels = [items[0], items[1], items[2]];
      const offsets = [48, 0, 48];
      return (
        <section id={id} className="bn-section" style={{ background: d.background, padding: "80px 0 72px" }}>
          <div className="bn-wrap" style={{ textAlign: "center" }}>
            {s.eyebrow && <p style={{ margin: "0 0 14px", color: d.accent, fontWeight: 700, fontSize: 14 }}>{s.eyebrow}</p>}
            <h1 style={{ fontFamily: d.headingFont, fontWeight: 500, fontSize: "clamp(40px,6.4vw,92px)", lineHeight: 1.02, letterSpacing: "-.035em", margin: "0 auto", maxWidth: 900 }}>{heading}</h1>
            {s.body && <p style={{ color: d.muted, lineHeight: 1.75, maxWidth: 520, margin: "20px auto 28px" }}>{s.body}</p>}
            <Cta s={s} d={d} bg={d.accent} fg={on(d.accent)} />
            <div className="bn-grid" style={{ gridTemplateColumns: "repeat(3,1fr)", gap: 18, marginTop: 56, alignItems: "start", textAlign: "left" }}>
              {panels.map((p, i) => (
                <div key={i} style={{ marginTop: offsets[i] }}>
                  <div style={{ aspectRatio: i === 1 ? "4/5" : "3/4", borderRadius: r, ...bgImg(i === 1 ? s.image || p?.image : p?.image, `linear-gradient(${150 + i * 20}deg, ${d.accent}${["44", "66", "33"][i]}, ${d.primary}22)`) }} />
                  {p && <p style={{ margin: "10px 2px 0", fontSize: 13, fontWeight: 600, display: "flex", justifyContent: "space-between" }}><span>{p.name}</span><span style={{ color: d.muted }}>{money(p)}</span></p>}
                </div>
              ))}
            </div>
          </div>
        </section>
      );
    }

    /* Text left, a 2x2 grid of live products right. Electronics, general stores. */
    case "tiles": {
      return (
        <section id={id} className="bn-section" style={{ background: d.background, padding: "56px 0 72px" }}>
          <div className={wrap} style={{ display: "grid", gridTemplateColumns: "1fr 1.1fr", gap: 48, alignItems: "center" }}>
            <div>
              {s.eyebrow && <p style={{ margin: "0 0 12px", color: d.accent, fontWeight: 700, fontSize: 14 }}>{s.eyebrow}</p>}
              <h1 style={{ fontFamily: d.headingFont, fontWeight: 800, fontSize: "clamp(36px,5vw,64px)", lineHeight: 1.05, letterSpacing: "-.035em", margin: 0 }}>{heading}</h1>
              {s.body && <p style={{ color: d.muted, lineHeight: 1.7, margin: "18px 0 26px", maxWidth: 480 }}>{s.body}</p>}
              <Cta s={s} d={d} bg={d.accent} fg={on(d.accent)} />
            </div>
            <div className="bn-grid" style={{ gridTemplateColumns: "1fr 1fr", gap: 12, padding: 14, background: d.surface, borderRadius: r + 6 }}>
              {[0, 1, 2, 3].map((i) => <Tile key={i} item={items[i]} d={d} ratio="1/1" r={Math.max(r - 2, 4)} />)}
            </div>
          </div>
        </section>
      );
    }

    /* Arched image beside text. Beauty, wellness, soft retail. */
    case "arch": {
      return (
        <section id={id} className="bn-section" style={{ background: d.surface, padding: "72px 0" }}>
          <div className={wrap} style={{ display: "grid", gridTemplateColumns: ".8fr 1.2fr", gap: 64, alignItems: "center" }}>
            <div style={{ position: "relative", maxWidth: 400, width: "100%", margin: "0 auto" }}>
              <div style={{ aspectRatio: "3/4", borderRadius: "999px 999px 24px 24px", ...bgImg(s.image, `linear-gradient(180deg, ${d.accent}66, ${d.accent}22)`) }} />
              <div aria-hidden style={{ position: "absolute", inset: "-12px -12px auto auto", width: 92, height: 92, borderRadius: "50%", border: `1px solid ${d.accent}`, opacity: 0.6 }} />
            </div>
            <div>
              {s.eyebrow && <p style={{ margin: "0 0 14px", color: d.accent, fontWeight: 700, fontSize: 14 }}>{s.eyebrow}</p>}
              <h1 style={{ fontFamily: d.headingFont, fontWeight: 500, fontSize: "clamp(38px,5.4vw,76px)", lineHeight: 1.04, letterSpacing: "-.03em", margin: 0 }}>{heading}</h1>
              {s.body && <p style={{ color: d.muted, lineHeight: 1.8, maxWidth: 480, margin: "22px 0 28px" }}>{s.body}</p>}
              <Cta s={s} d={d} bg={d.primary} fg={on(d.primary)} />
            </div>
          </div>
        </section>
      );
    }

    /* Big statement left, an index of what the business offers right. Agencies, professional services. */
    case "ledger": {
      const rows = (categories.length ? categories : items.map((i) => i.name)).slice(0, 5);
      return (
        <section id={id} className="bn-section" style={{ background: d.background, padding: "72px 0 64px" }}>
          <div className="bn-wrap" style={{ borderTop: `3px solid ${d.text}`, paddingTop: 28 }}>
            <div className="bn-hero" style={{ display: "grid", gridTemplateColumns: "1.25fr .75fr", gap: 56, alignItems: "end" }}>
              <div>
                {s.eyebrow && <p style={{ margin: "0 0 18px", color: d.muted, fontSize: 14 }}>{s.eyebrow}</p>}
                <h1 style={{ fontFamily: d.headingFont, fontWeight: 700, fontSize: "clamp(40px,6.4vw,92px)", lineHeight: 0.98, letterSpacing: "-.045em", margin: 0 }}>{heading}</h1>
              </div>
              <div>
                {s.body && <p style={{ color: d.muted, lineHeight: 1.7, margin: "0 0 20px" }}>{s.body}</p>}
                {rows.length > 0 && (
                  <ul style={{ listStyle: "none", margin: "0 0 24px", padding: 0, borderTop: `1px solid ${d.text}22` }}>
                    {rows.map((row) => <li key={row} style={{ padding: "11px 0", borderBottom: `1px solid ${d.text}22`, fontWeight: 650, fontSize: 15, display: "flex", justifyContent: "space-between" }}><span>{row}</span><span style={{ color: d.accent }}>→</span></li>)}
                  </ul>
                )}
                <Cta s={s} d={d} bg={d.accent} fg={on(d.accent)} />
              </div>
            </div>
          </div>
        </section>
      );
    }

    /* Inset hairline frame over a full image, caption bar below. Photography, galleries, interiors. */
    case "frame": {
      const ink = s.image ? "#fff" : d.text;
      return (
        <section id={id} className="bn-section" style={{ background: d.background, padding: "28px 0 56px" }}>
          <div className="bn-wrap">
            <div style={{ position: "relative", minHeight: 560, borderRadius: r, overflow: "hidden", display: "grid", placeItems: "center", textAlign: "center", color: ink, background: s.image ? `linear-gradient(rgba(0,0,0,.32),rgba(0,0,0,.32)), url(${s.image}) center/cover` : d.surface }}>
              <div aria-hidden style={{ position: "absolute", inset: 18, border: `1px solid ${ink}`, opacity: 0.55, borderRadius: Math.max(r - 4, 0) }} />
              <div style={{ position: "relative", padding: "0 8%" }}>
                <h1 style={{ fontFamily: d.headingFont, fontWeight: 400, fontSize: "clamp(40px,6.6vw,96px)", lineHeight: 1.02, letterSpacing: "-.02em", margin: 0 }}>{heading}</h1>
              </div>
            </div>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 20, flexWrap: "wrap", padding: "18px 4px 0" }}>
              <p style={{ margin: 0, color: d.muted, maxWidth: 560, lineHeight: 1.6, fontSize: 14 }}>{s.body || s.eyebrow}</p>
              <Cta s={s} d={d} bg={d.text} fg={d.text} kind="link" />
            </div>
          </div>
        </section>
      );
    }

    /* Wide image with an overlapping card. Hotels, real estate, devices. */
    case "splitcard": {
      return (
        <section id={id} className="bn-section" style={{ background: d.background, padding: "0 0 72px" }}>
          <div style={{ minHeight: 520, ...bgImg(s.image, `linear-gradient(135deg, ${d.primary}, ${d.accent})`) }} />
          <div className="bn-wrap" style={{ position: "relative" }}>
            <div style={{ marginTop: -150, width: "min(560px,100%)", background: d.surface, color: d.text, padding: "36px 36px 34px", borderRadius: r, boxShadow: "0 24px 60px rgba(0,0,0,.18)" }}>
              {s.eyebrow && <p style={{ margin: "0 0 10px", color: d.accent, fontWeight: 700, fontSize: 13 }}>{s.eyebrow}</p>}
              <h1 style={{ fontFamily: d.headingFont, fontWeight: 700, fontSize: "clamp(30px,4vw,52px)", lineHeight: 1.06, letterSpacing: "-.03em", margin: 0 }}>{heading}</h1>
              {s.body && <p style={{ color: d.muted, lineHeight: 1.7, margin: "16px 0 24px" }}>{s.body}</p>}
              <Cta s={s} d={d} bg={d.accent} fg={on(d.accent)} />
            </div>
          </div>
        </section>
      );
    }

    /* Text beside a printed-menu style card of live items. Restaurants and cafes. */
    case "menu": {
      const rows = items.slice(0, 4);
      return (
        <section id={id} className="bn-section" style={{ background: d.background, padding: "80px 0" }}>
          <div className={wrap} style={{ display: "grid", gridTemplateColumns: "1.1fr .9fr", gap: 56, alignItems: "center" }}>
            <div>
              <h1 style={{ fontFamily: d.headingFont, fontWeight: 600, fontSize: "clamp(42px,6vw,88px)", lineHeight: 1, letterSpacing: "-.03em", margin: 0 }}>{heading}</h1>
              {s.body && <p style={{ color: d.muted, lineHeight: 1.75, maxWidth: 480, margin: "24px 0 30px" }}>{s.body}</p>}
              <Cta s={s} d={d} bg={d.accent} fg={on(d.accent)} />
            </div>
            <div style={{ background: d.surface, border: `1px solid ${d.accent}66`, outline: `1px solid ${d.accent}33`, outlineOffset: 8, borderRadius: r, padding: "30px 28px" }}>
              <p style={{ margin: "0 0 18px", textAlign: "center", fontFamily: d.headingFont, fontSize: 22, color: d.accent }}>{s.eyebrow || "On the menu"}</p>
              {rows.length ? rows.map((i) => (
                <div key={i.id} style={{ display: "flex", alignItems: "baseline", gap: 8, padding: "9px 0" }}>
                  <span style={{ fontWeight: 650 }}>{i.name}</span><span aria-hidden style={{ flex: 1, borderBottom: `1px dotted ${d.text}55` }} /><span style={{ color: d.accent, fontWeight: 800 }}>{money(i)}</span>
                </div>
              )) : <p style={{ margin: 0, textAlign: "center", color: d.muted, fontSize: 14 }}>Your published dishes will appear here.</p>}
            </div>
          </div>
        </section>
      );
    }

    /* Solid accent band with a tilted product card and a cut bottom edge. Promotions, groceries, deals. */
    case "banner": {
      const bg = d.accent, fg = on(bg);
      const hero = items.find((i) => i.image);
      return (
        <section id={id} className="bn-section" style={{ background: bg, color: fg, padding: "64px 0 112px", clipPath: "polygon(0 0,100% 0,100% 90%,0 100%)" }}>
          <div className={wrap} style={{ display: "grid", gridTemplateColumns: "1.2fr .8fr", gap: 40, alignItems: "center" }}>
            <div>
              {s.eyebrow && <span style={{ display: "inline-block", border: `1.5px solid ${fg}`, borderRadius: 999, padding: "5px 14px", fontWeight: 800, fontSize: 13, marginBottom: 20 }}>{s.eyebrow}</span>}
              <h1 style={{ fontFamily: d.headingFont, fontWeight: 900, fontSize: "clamp(40px,6vw,84px)", lineHeight: 0.98, letterSpacing: "-.04em", margin: 0 }}>{heading}</h1>
              {s.body && <p style={{ opacity: 0.86, lineHeight: 1.65, maxWidth: 460, margin: "20px 0 28px" }}>{s.body}</p>}
              <Cta s={s} d={d} bg={fg} fg={bg} />
            </div>
            <div style={{ transform: "rotate(-3deg)", background: "#fff", color: "#111", padding: 14, borderRadius: r, boxShadow: "0 24px 50px rgba(0,0,0,.22)", maxWidth: 340, justifySelf: "center", width: "100%" }}>
              <div style={{ aspectRatio: "1/1", borderRadius: Math.max(r - 4, 4), ...bgImg(s.image || hero?.image, `linear-gradient(135deg, ${d.primary}33, ${d.accent}55)`) }} />
              {hero && <p style={{ margin: "12px 2px 2px", display: "flex", justifyContent: "space-between", fontWeight: 800, fontSize: 14 }}><span>{hero.name}</span><span>{money(hero)}</span></p>}
            </div>
          </div>
        </section>
      );
    }

    /* Lots of air, light type, a thin image strip. Cleaning, wellness, minimal brands. */
    case "quiet": {
      return (
        <section id={id} className="bn-section" style={{ background: d.background, padding: "112px 0 56px" }}>
          <div className="bn-wrap" style={{ textAlign: "center" }}>
            <h1 style={{ fontFamily: d.headingFont, fontWeight: 300, fontSize: "clamp(36px,5.2vw,68px)", lineHeight: 1.12, letterSpacing: "-.025em", margin: "0 auto", maxWidth: 760 }}>{heading}</h1>
            <div aria-hidden style={{ width: 56, height: 1, background: d.accent, margin: "30px auto" }} />
            {s.body && <p style={{ color: d.muted, lineHeight: 1.85, maxWidth: 520, margin: "0 auto 28px" }}>{s.body}</p>}
            <Cta s={s} d={d} bg={d.accent} fg={d.text} kind="link" />
            <div style={{ height: 260, marginTop: 64, borderRadius: r, ...bgImg(s.image, `linear-gradient(90deg, ${d.accent}22, ${d.accent}55, ${d.accent}22)`) }} />
          </div>
        </section>
      );
    }
  }
}
