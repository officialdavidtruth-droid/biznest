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
        <div style={{ position: "absolute", left: 10, right: 10, bottom: 10, background: `${d.background}ee`, color: d.text, borderRadius: Math.min(r, 10), padding: "8px 10px", display: "flex", justifyContent: "space-between", gap: 8, fontSize: 12, fontWeight: 700 }}>
          <span style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{item.name}</span><span style={{ whiteSpace: "nowrap", color: d.accent }}>{money(item)}</span>
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
    /* Solid brand panel with a tilted photo and a round price badge, plus a row of round category thumbnails. Grocery, markets. */
    case "market": {
      const chips = (s.items ?? []).filter((i) => i.title.trim()).slice(0, 4);
      const lowest = items.length ? items.reduce((a, b) => (b.price < a.price ? b : a)) : null;
      const photo = s.image || items.find((i) => i.image)?.image;
      const bg = d.primary, fg = on(bg);
      const cats = categories.slice(0, 8).map((name) => ({ name, image: items.find((i) => i.categoryName === name && i.image)?.image ?? null }));
      return (
        <section id={id} data-bn-type="hero" className="bn-section" style={{ background: d.background, padding: "22px 0 8px" }}>
          <div className="bn-wrap">
            <div className="bn-hero" style={{ position: "relative", display: "grid", gridTemplateColumns: "1.05fr .95fr", alignItems: "center", gap: 24, padding: "clamp(28px,5vw,58px)", borderRadius: r + 12, background: bg, color: fg, overflow: "hidden" }}>
              <div aria-hidden style={{ position: "absolute", right: "-8%", top: "-30%", width: "48%", aspectRatio: "1/1", borderRadius: "50%", background: `${d.accent}33` }} />
              <div style={{ position: "relative" }}>
                {s.eyebrow && <span style={{ display: "inline-block", padding: "5px 12px", borderRadius: 999, background: `${d.accent}`, color: on(d.accent), fontWeight: 800, fontSize: 12, marginBottom: 16 }}>{s.eyebrow}</span>}
                <h1 style={{ fontFamily: d.headingFont, fontWeight: 700, fontSize: "clamp(36px,5vw,66px)", lineHeight: 1.04, letterSpacing: "-.03em", margin: 0 }}>{heading}</h1>
                {s.body && <p style={{ opacity: .85, lineHeight: 1.7, maxWidth: 440, margin: "16px 0 24px" }}>{s.body}</p>}
                <div style={{ display: "flex", gap: 12, flexWrap: "wrap" }}><Cta s={s} d={d} bg={d.accent} fg={on(d.accent)} /><a href="#catalog" style={{ display: "inline-block", padding: "13px 22px", borderRadius: d.buttonStyle === "pill" ? 999 : Math.min(d.radius, 14), border: `1.5px solid ${fg}55`, fontWeight: 750, fontSize: 14 }}>See deals</a></div>
                {chips.length > 0 && <div style={{ display: "flex", gap: 18, flexWrap: "wrap", marginTop: 24, fontSize: 12.5, opacity: .9 }}>{chips.map((c, i) => <span key={i}>✓ {c.title}</span>)}</div>}
              </div>
              <div style={{ position: "relative", justifySelf: "center", width: "min(100%,440px)" }}>
                <div aria-hidden style={{ aspectRatio: "5/4", borderRadius: r + 6, transform: "rotate(-3deg)", ...bgImg(photo, `linear-gradient(160deg, ${d.accent}88, ${d.accent}33)`), boxShadow: "0 24px 60px rgba(0,0,0,.3)", border: `6px solid ${fg}` }} />
                {lowest && <div style={{ position: "absolute", right: -6, top: -14, width: 96, height: 96, borderRadius: "50%", display: "grid", placeItems: "center", textAlign: "center", background: d.accent, color: on(d.accent), fontWeight: 800, lineHeight: 1.1, boxShadow: "0 10px 26px rgba(0,0,0,.25)", transform: "rotate(8deg)" }}><span style={{ fontSize: 11 }}>From<br /><span style={{ fontSize: 15, fontFamily: d.headingFont }}>{money(lowest)}</span></span></div>}
              </div>
            </div>
            {cats.length > 0 && <div style={{ display: "flex", gap: 20, overflowX: "auto", padding: "22px 4px 6px" }}>{cats.map((c) => <a key={c.name} href={slug ? `/store/${slug}/search?q=${encodeURIComponent(c.name)}` : "#catalog"} style={{ flex: "none", width: 86, textAlign: "center", fontSize: 12.5, fontWeight: 750 }}><span aria-hidden style={{ display: "block", width: 72, height: 72, margin: "0 auto 8px", borderRadius: "50%", background: c.image ? `url(${cssUrl(c.image)}) center/cover` : `${d.accent}26`, border: `2px solid ${d.accent}55` }} />{c.name}</a>)}</div>}
          </div>
        </section>
      );
    }

    /* A fan of three overlapping product photos on a soft gradient. Beauty, skincare, gifts. */
    case "glow": {
      const chips = (s.items ?? []).filter((i) => i.title.trim()).slice(0, 4);
      const picks = items.filter((i) => i.image).slice(0, 3);
      const fan = [{ rot: -8, x: -34, z: 1 }, { rot: 0, x: 0, z: 3 }, { rot: 8, x: 34, z: 2 }];
      return (
        <section id={id} data-bn-type="hero" className="bn-section" style={{ background: d.background, padding: "22px 0 18px" }}>
          <div className="bn-wrap">
            <div className="bn-hero" style={{ position: "relative", overflow: "hidden", display: "grid", gridTemplateColumns: "1fr 1fr", alignItems: "center", gap: 20, padding: "clamp(28px,5vw,64px)", borderRadius: r + 18, background: `radial-gradient(circle at 85% 20%, ${d.accent}55, transparent 55%), linear-gradient(135deg, ${d.surface}, ${d.accent}30)` }}>
              <div>
                {s.eyebrow && <p style={{ margin: "0 0 14px", color: d.accent, fontWeight: 700, fontSize: 14, fontFamily: d.headingFont, fontStyle: "italic" }}>{s.eyebrow}</p>}
                <h1 style={{ fontFamily: d.headingFont, fontWeight: 500, fontSize: "clamp(40px,5.6vw,78px)", lineHeight: 1, letterSpacing: "-.03em", margin: 0 }}>{heading}</h1>
                {s.body && <p style={{ color: d.muted, lineHeight: 1.8, maxWidth: 430, margin: "20px 0 28px" }}>{s.body}</p>}
                <Cta s={s} d={d} bg={d.primary} fg={on(d.primary)} />
                {chips.length > 0 && <div style={{ display: "flex", gap: 18, flexWrap: "wrap", marginTop: 26, fontSize: 12.5, color: d.muted }}>{chips.map((c, i) => <span key={i}>◦ {c.title}</span>)}</div>}
              </div>
              <div style={{ position: "relative", height: "clamp(280px,36vw,420px)", display: "flex", justifyContent: "center", alignItems: "center" }}>
                {(picks.length ? picks : [undefined, undefined, undefined]).map((it, i) => (
                  <div key={i} style={{ position: "absolute", width: "40%", aspectRatio: "3/4", transform: `translateX(${fan[i].x * 3}px) rotate(${fan[i].rot}deg)`, zIndex: fan[i].z, borderRadius: r + 4, border: `5px solid ${d.background}`, boxShadow: "0 22px 50px rgba(0,0,0,.18)", ...bgImg(it?.image, `linear-gradient(${150 + i * 25}deg, ${d.accent}77, ${d.accent}22)`) }}>
                    {it && <span style={{ position: "absolute", left: 8, right: 8, bottom: 8, padding: "5px 8px", borderRadius: 999, background: `${d.background}ee`, fontSize: 11, fontWeight: 750, textAlign: "center", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{it.name}</span>}
                  </div>
                ))}
              </div>
            </div>
          </div>
        </section>
      );
    }

    /* Dark showroom: photo fades into the page, headline left, quick filter chips and search built into the same panel. Cars, bikes, equipment. */
    case "showroom": {
      const chips = (s.items ?? []).filter((i) => i.title.trim()).slice(0, 4);
      const action = slug ? `/store/${slug}/search` : "#catalog";
      const quick = categories.slice(0, 6);
      return (
        <section id={id} data-bn-type="hero" className="bn-section" style={{ background: d.primary, color: "#fff", position: "relative", overflow: "hidden" }}>
          <div aria-hidden style={{ position: "absolute", inset: 0, ...bgImg(s.image, `linear-gradient(135deg, ${d.primary}, ${d.accent}55)`), opacity: .9 }} />
          <div aria-hidden style={{ position: "absolute", inset: 0, background: `linear-gradient(90deg, ${d.primary} 0%, ${d.primary}f0 38%, ${d.primary}55 72%, ${d.primary}22 100%)` }} />
          <div className="bn-wrap" style={{ position: "relative", padding: "clamp(56px,8vw,110px) 0 clamp(40px,6vw,70px)" }}>
            {s.eyebrow && <span style={{ display: "inline-block", padding: "5px 12px", borderRadius: 6, background: d.accent, color: on(d.accent), fontWeight: 800, fontSize: 12, marginBottom: 18 }}>{s.eyebrow}</span>}
            <h1 style={{ fontFamily: d.headingFont, fontWeight: 800, fontSize: "clamp(40px,6.4vw,86px)", lineHeight: 1, letterSpacing: "-.04em", margin: 0, maxWidth: 640 }}>{heading}</h1>
            {s.body && <p style={{ opacity: .85, lineHeight: 1.7, maxWidth: 480, margin: "18px 0 0", fontSize: 17 }}>{s.body}</p>}
            <form action={action} method="get" role="search" style={{ display: "flex", gap: 10, flexWrap: "wrap", marginTop: 30, maxWidth: 660, padding: 10, borderRadius: Math.min(r, 18), background: "rgba(255,255,255,.1)", border: "1px solid rgba(255,255,255,.2)", backdropFilter: "blur(10px)" }}>
              <input name="q" placeholder="Search make, model or type" autoComplete="off" style={{ flex: "1 1 220px", padding: "13px 16px", borderRadius: Math.min(r, 12), border: 0, background: "#fff", color: "#111", fontSize: 15 }} />
              <button type="submit" style={{ padding: "13px 26px", borderRadius: Math.min(r, 12), border: 0, background: d.accent, color: on(d.accent), fontWeight: 800, cursor: "pointer" }}>{s.ctaLabel || "Search"}</button>
            </form>
            {quick.length > 0 && <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginTop: 14 }}>{quick.map((q) => <a key={q} href={slug ? `/store/${slug}/search?q=${encodeURIComponent(q)}` : "#catalog"} style={{ padding: "6px 14px", borderRadius: 999, border: "1px solid rgba(255,255,255,.3)", fontSize: 13, fontWeight: 650 }}>{q}</a>)}</div>}
            {chips.length > 0 && <div style={{ display: "flex", gap: 34, flexWrap: "wrap", marginTop: 34, paddingTop: 22, borderTop: "1px solid rgba(255,255,255,.18)" }}>{chips.map((c, i) => <div key={i}><div style={{ fontFamily: d.headingFont, fontWeight: 800, fontSize: 20 }}>{c.title}</div>{c.body && <div style={{ opacity: .7, fontSize: 12.5 }}>{c.body}</div>}</div>)}</div>}
          </div>
        </section>
      );
    }

    /* Soft gradient panel: headline, trust chips, and a round photo with a price badge. Electronics, gadgets, lifestyle retail. */
    case "spotlight": {
      const chips = (s.items ?? []).filter((i) => i.title.trim()).slice(0, 4);
      const lowest = items.length ? items.reduce((a, b) => (b.price < a.price ? b : a)) : null;
      const photo = s.image || items.find((i) => i.image)?.image;
      return (
        <section id={id} data-bn-type="hero" className="bn-section" style={{ background: d.background, padding: "28px 0 20px" }}>
          <div className="bn-wrap">
            <div className="bn-hero" style={{ position: "relative", overflow: "hidden", display: "grid", gridTemplateColumns: "1.1fr .9fr", alignItems: "center", gap: 24, padding: "clamp(28px,5vw,64px)", borderRadius: r + 14, background: `linear-gradient(120deg, ${d.accent}1f 0%, ${d.surface} 55%, ${d.accent}33 100%)` }}>
              <div>
                {s.eyebrow && <span style={{ display: "inline-block", padding: "6px 14px", borderRadius: 999, background: `${d.accent}22`, color: d.primary, fontWeight: 800, fontSize: 12, marginBottom: 18 }}>{s.eyebrow}</span>}
                <h1 style={{ fontFamily: d.headingFont, fontWeight: 800, fontSize: "clamp(36px,5.2vw,68px)", lineHeight: 1.04, letterSpacing: "-.035em", margin: 0 }}>{heading}</h1>
                {s.body && <p style={{ color: d.muted, lineHeight: 1.7, maxWidth: 440, margin: "18px 0 26px", fontSize: 16 }}>{s.body}</p>}
                <div style={{ display: "flex", gap: 12, flexWrap: "wrap" }}>
                  <Cta s={s} d={d} bg={d.primary} fg={on(d.primary)} />
                  <a href="#catalog" style={{ display: "inline-block", padding: "13px 22px", borderRadius: d.buttonStyle === "pill" ? 999 : Math.min(d.radius, 14), border: `1px solid ${d.text}26`, background: d.background, fontWeight: 750, fontSize: 14 }}>Explore more</a>
                </div>
                {chips.length > 0 && <div style={{ display: "flex", gap: 10, flexWrap: "wrap", marginTop: 26 }}>{chips.map((c, i) => <div key={i} style={{ padding: "9px 14px", borderRadius: 14, background: `${d.background}cc`, border: `1px solid ${d.text}0f`, fontSize: 12 }}><strong style={{ display: "block", fontSize: 12.5 }}>{c.title}</strong>{c.body && <span style={{ color: d.muted }}>{c.body}</span>}</div>)}</div>}
              </div>
              <div style={{ position: "relative", justifySelf: "center", width: "min(100%,440px)" }}>
                <div aria-hidden style={{ aspectRatio: "1/1", borderRadius: "50%", ...bgImg(photo, `linear-gradient(160deg, ${d.accent}66, ${d.primary}44)`), boxShadow: `0 30px 70px ${d.primary}2e` }} />
                {lowest && <div style={{ position: "absolute", left: "-4%", bottom: "10%", padding: "14px 18px", borderRadius: 22, background: d.accent, color: on(d.accent), boxShadow: `0 14px 34px ${d.accent}66`, textAlign: "center", lineHeight: 1.15 }}><div style={{ fontSize: 11, fontWeight: 700, opacity: .85 }}>From</div><div style={{ fontFamily: d.headingFont, fontWeight: 800, fontSize: 19 }}>{money(lowest)}</div></div>}
              </div>
            </div>
          </div>
        </section>
      );
    }

    /* Full-bleed photograph with a search card overlapping its bottom edge. Travel, car hire and rentals, property. */
    case "voyage": {
      const chips = (s.items ?? []).filter((i) => i.title.trim()).slice(0, 4);
      const options = Array.from(new Set([...categories, ...items.map((i) => i.name)])).slice(0, 12);
      const action = slug ? `/store/${slug}/search` : "#catalog";
      return (
        <section id={id} data-bn-type="hero" className="bn-section" style={{ background: d.background, paddingBottom: 36 }}>
          <div style={{ position: "relative", color: "#fff", padding: "clamp(64px,9vw,120px) 0 clamp(96px,12vw,150px)", ...bgImg(s.image ? `${s.image}` : null, `linear-gradient(135deg, ${d.primary}, ${d.accent})`) }}>
            <div aria-hidden style={{ position: "absolute", inset: 0, background: `linear-gradient(90deg, ${d.primary}e6 0%, ${d.primary}99 42%, ${d.primary}1a 100%)` }} />
            <div className="bn-wrap" style={{ position: "relative" }}>
              {s.eyebrow && <span style={{ display: "inline-block", padding: "6px 14px", borderRadius: 999, background: "rgba(255,255,255,.16)", border: "1px solid rgba(255,255,255,.28)", fontWeight: 750, fontSize: 12, marginBottom: 18 }}>{s.eyebrow}</span>}
              <h1 style={{ fontFamily: d.headingFont, fontWeight: 800, fontSize: "clamp(38px,6vw,80px)", lineHeight: 1.02, letterSpacing: "-.035em", margin: 0, maxWidth: 760 }}>{heading}</h1>
              {s.body && <p style={{ opacity: .9, lineHeight: 1.7, maxWidth: 520, margin: "18px 0 26px", fontSize: 17 }}>{s.body}</p>}
              <Cta s={s} d={d} bg={d.accent} fg={on(d.accent)} />
            </div>
          </div>
          <div className="bn-wrap" style={{ position: "relative", marginTop: -54 }}>
            <form action={action} method="get" role="search" style={{ display: "flex", gap: 12, alignItems: "center", flexWrap: "wrap", padding: 16, borderRadius: r + 8, background: d.surface, border: `1px solid ${d.text}10`, boxShadow: "0 24px 60px rgba(0,0,0,.16)" }}>
              <label style={{ flex: "1 1 260px", display: "block" }}>
                <span style={{ display: "block", fontSize: 11, fontWeight: 800, color: d.muted, margin: "0 0 4px 4px" }}>What are you looking for?</span>
                <input name="q" list="bn-hero-search" placeholder="Search by name or category" autoComplete="off" style={{ width: "100%", padding: "13px 16px", borderRadius: Math.min(r, 16), border: `1px solid ${d.text}1f`, background: d.background, color: d.text, fontSize: 15 }} />
                <datalist id="bn-hero-search">{options.map((o) => <option key={o} value={o} />)}</datalist>
              </label>
              <button type="submit" style={{ alignSelf: "flex-end", padding: "14px 28px", borderRadius: Math.min(r, 16), border: 0, background: d.primary, color: on(d.primary), fontWeight: 800, fontSize: 14, cursor: "pointer" }}>Search</button>
            </form>
            {chips.length > 0 && <div style={{ display: "flex", gap: 28, flexWrap: "wrap", marginTop: 22 }}>{chips.map((c, i) => <div key={i} style={{ display: "flex", gap: 10, alignItems: "center" }}><span aria-hidden style={{ width: 36, height: 36, borderRadius: 12, display: "grid", placeItems: "center", background: `${d.accent}1f`, color: d.accent, fontWeight: 900 }}>✓</span><span style={{ fontSize: 13 }}><strong style={{ display: "block" }}>{c.title}</strong>{c.body && <span style={{ color: d.muted }}>{c.body}</span>}</span></div>)}</div>}
          </div>
        </section>
      );
    }

    /* Dark glow stage: headline left, one product lit on a plinth. Premium tech, audio, watches. */
    case "aurora": {
      const star = items.find((i) => i.image);
      const photo = s.image || star?.image;
      const stage = on(d.primary) === "#fff";
      return (
        <section id={id} data-bn-type="hero" className="bn-section" style={{ background: d.background, padding: "24px 0" }}>
          <div className="bn-wrap">
            <div className="bn-hero" style={{ position: "relative", overflow: "hidden", display: "grid", gridTemplateColumns: "1.05fr .95fr", alignItems: "center", gap: 20, padding: "clamp(28px,5vw,64px)", borderRadius: r + 14, color: stage ? "#fff" : d.text, background: `radial-gradient(ellipse at 78% 55%, ${d.accent}66 0%, transparent 55%), linear-gradient(135deg, ${d.primary} 0%, ${d.primary} 40%, ${d.accent}55 100%)`, border: `1px solid ${d.accent}33` }}>
              <div>
                {s.eyebrow && <span style={{ display: "inline-block", padding: "5px 13px", borderRadius: 999, border: `1px solid ${d.accent}66`, color: d.accent, fontWeight: 750, fontSize: 12, marginBottom: 18 }}>{s.eyebrow}</span>}
                <h1 style={{ fontFamily: d.headingFont, fontWeight: 600, fontSize: "clamp(38px,5.4vw,72px)", lineHeight: 1.04, letterSpacing: "-.035em", margin: 0 }}>{heading}</h1>
                {s.body && <p style={{ opacity: .8, lineHeight: 1.7, maxWidth: 430, margin: "18px 0 26px" }}>{s.body}</p>}
                <div style={{ display: "flex", gap: 12, flexWrap: "wrap" }}>
                  <Cta s={s} d={d} bg={d.accent} fg={on(d.accent)} />
                  <a href="#catalog" style={{ display: "inline-block", padding: "13px 22px", borderRadius: d.buttonStyle === "pill" ? 999 : Math.min(d.radius, 14), border: "1px solid rgba(255,255,255,.28)", fontWeight: 750, fontSize: 14 }}>Explore collection</a>
                </div>
              </div>
              <div style={{ position: "relative", justifySelf: "center", width: "min(100%,420px)", aspectRatio: "1/1" }}>
                <div aria-hidden style={{ position: "absolute", left: "8%", right: "8%", bottom: "2%", height: "18%", borderRadius: "50%", background: `radial-gradient(ellipse, ${d.accent}aa, transparent 70%)`, filter: "blur(6px)" }} />
                <div aria-hidden style={{ position: "absolute", inset: "4% 6% 12%", borderRadius: 28, ...bgImg(photo, `linear-gradient(160deg, ${d.accent}55, transparent)`), boxShadow: `0 30px 80px ${d.accent}40` }} />
              </div>
            </div>
          </div>
        </section>
      );
    }

    /* Oversized type on a dark field with an accent slab cutting in from the right. Drops, sport, streetwear. */
    case "poster": {
      const bg = d.primary, fg = on(bg);
      return (
        <section id={id} data-bn-type="hero" className="bn-section" style={{ position: "relative", overflow: "hidden", background: bg, color: fg, padding: "88px 0 0" }}>
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
        <section id={id} data-bn-type="hero" className="bn-section" style={{ background: d.background, padding: "64px 0 80px" }}>
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
        <section id={id} data-bn-type="hero" className="bn-section" style={{ background: d.background, padding: "80px 0 72px" }}>
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
        <section id={id} data-bn-type="hero" className="bn-section" style={{ background: d.background, padding: "56px 0 72px" }}>
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
        <section id={id} data-bn-type="hero" className="bn-section" style={{ background: d.surface, padding: "72px 0" }}>
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
        <section id={id} data-bn-type="hero" className="bn-section" style={{ background: d.background, padding: "72px 0 64px" }}>
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
        <section id={id} data-bn-type="hero" className="bn-section" style={{ background: d.background, padding: "28px 0 56px" }}>
          <div className="bn-wrap">
            <div style={{ position: "relative", minHeight: 560, borderRadius: r, overflow: "hidden", display: "grid", placeItems: "center", textAlign: "center", color: ink, background: s.image ? `linear-gradient(rgba(0,0,0,.32),rgba(0,0,0,.32)), url(${cssUrl(s.image)}) center/cover` : d.surface }}>
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
        <section id={id} data-bn-type="hero" className="bn-section" style={{ background: d.background, padding: "0 0 72px" }}>
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
        <section id={id} data-bn-type="hero" className="bn-section" style={{ background: s.image ? `linear-gradient(90deg, ${d.background}f2 0%, ${d.background}cc 55%, ${d.background}99 100%), url(${cssUrl(s.image)}) center/cover` : d.background, padding: "80px 0" }}>
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
        <section id={id} data-bn-type="hero" className="bn-section" style={{ background: bg, color: fg, padding: "64px 0 112px", clipPath: "polygon(0 0,100% 0,100% 90%,0 100%)" }}>
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
        <section id={id} data-bn-type="hero" className="bn-section" style={{ background: d.background, padding: "112px 0 56px" }}>
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
