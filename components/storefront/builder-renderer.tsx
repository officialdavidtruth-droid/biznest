"use client";

import { MenuLinks, type FallbackLink } from "@/components/storefront/store-menu";
import type React from "react";
import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import Link from "next/link";
import { CartLink } from "@/components/storefront/cart-link";
import { BuilderNewsletterForm } from "@/components/storefront/builder-newsletter-form";
import type { BuilderConfig, BuilderSection } from "@/lib/builder-config";
import { getBusinessExperience } from "@/lib/business-experience";
import { HeroVariantView } from "@/components/storefront/hero-variants";

type CatalogItem = {
  id: string; kind: "product" | "service"; name: string; price: number; currency: string;
  image: string | null; categoryName: string | null;
};

type Review = { id: string; rating: number; comment: string | null; author: { name: string | null } | null };

type BuilderStore = {
  name: string; slug: string; logoUrl: string | null; contactEmail: string | null; contactPhone: string | null;
  business: { description: string | null; category?: string | null; businessSubcategory?: string | null; sellsProducts?: boolean; offersServices?: boolean };
};

export function BuilderStorefront({
  store, config: initialConfig, catalogItems, reviews, avgRating, completedOrders,
}: {
  store: BuilderStore;
  config: BuilderConfig;
  catalogItems: CatalogItem[];
  reviews: Review[];
  avgRating: number | null;
  completedOrders: number;
}) {
  const [liveConfig, setLiveConfig] = useState<BuilderConfig>(initialConfig);
  // True only when this storefront is rendered inside the customizer's
  // preview iframe (see components/dashboard/customizer-client.tsx) — never
  // on the real, live storefront a customer visits at /store/[slug].
  const [isEditMode, setIsEditMode] = useState(false);

  useEffect(() => {
    setIsEditMode(window.self !== window.top);
  }, []);

  useEffect(() => {
    setLiveConfig(initialConfig);
  }, [initialConfig]);

  useEffect(() => {
    // Tell the parent editor exactly when the preview iframe is ready to
    // receive draft builder state. This prevents the first live update from
    // being lost during iframe startup/navigation.
    window.parent?.postMessage(
      { type: "BIZNEST_CUSTOMIZER_PREVIEW_READY" },
      window.location.origin,
    );

    function handleMessage(event: MessageEvent) {
      if (event.source !== window.parent) return;
      if (event.origin !== window.location.origin) return;
      const data = event.data;
      if (!data || data.type !== "BIZNEST_CUSTOMIZER_PREVIEW") return;
      if (!data.config || typeof data.config !== "object") return;
      setLiveConfig(data.config as BuilderConfig);
    }

    window.addEventListener("message", handleMessage);
    return () => window.removeEventListener("message", handleMessage);
  }, []);

  const d = liveConfig.design;
  const config = liveConfig; // used by JSX below (BuilderSectionView expects `config`)
  const experience = getBusinessExperience(store.business.category, { sellsProducts: store.business.sellsProducts, offersServices: store.business.offersServices }, store.business.businessSubcategory);
  const width = d.containerWidth === "compact" ? 960 : d.containerWidth === "wide" ? 1320 : 1160;
  const visible = config.sections.filter((s) => s.visible);
  const featured = catalogItems.slice(0, 8);
  const categories = Array.from(new Set(catalogItems.map((i) => i.categoryName).filter(Boolean))) as string[];

  // Every rendered section carries a plain `id={section.id}` (see
  // BuilderSectionView below) and nothing else in this component sets an
  // `id` attribute, so the nearest ancestor with an id is always the
  // clicked section. Only active in the customizer's preview iframe —
  // intercepting/preventing normal link navigation on the real storefront
  // would break the actual customer experience.
  function handleSectionClick(e: React.MouseEvent) {
    if (!isEditMode) return;
    const target = (e.target as HTMLElement).closest("[id]") as HTMLElement | null;
    if (!target?.id || !config.sections.some((s) => s.id === target.id)) return;
    e.preventDefault();
    e.stopPropagation();
    window.parent?.postMessage(
      { type: "BIZNEST_CUSTOMIZER_SELECT_SECTION", sectionId: target.id },
      window.location.origin,
    );
  }

  return (
    <main onClickCapture={handleSectionClick} style={{ background: d.background, color: d.text, fontFamily: d.font, minHeight: "100vh" }}>
      <style>{`a{text-decoration:none;color:inherit}.bn-wrap{width:min(${width}px,calc(100% - 32px));margin:0 auto}.bn-grid{display:grid;gap:20px}@media(max-width:720px){.bn-grid{grid-template-columns:1fr!important}.bn-hero{grid-template-columns:1fr!important}.bn-section{padding-top:56px!important;padding-bottom:56px!important}.bn-nav-links{display:none!important}}${isEditMode ? `.bn-section{cursor:pointer;transition:outline .12s ease}.bn-section:hover{outline:2px dashed ${d.accent};outline-offset:-2px}` : ""}`}</style>
      <BuilderHeader store={store} d={d} experience={experience} visible={visible} />

      {visible.map((section) => <BuilderSectionView key={section.id} section={section} store={store} config={config} catalogItems={featured} categories={categories} experience={experience} reviews={reviews} avgRating={avgRating} completedOrders={completedOrders} />)}

      <BuilderFooter store={store} d={d} visible={visible} />
    </main>
  );
}

function BuilderSectionView({ section, store, config, catalogItems, categories, experience, reviews, avgRating, completedOrders }: {
  section: BuilderSection; store: BuilderStore; config: BuilderConfig; catalogItems: CatalogItem[]; categories: string[]; experience: ReturnType<typeof getBusinessExperience>; reviews: Review[]; avgRating: number | null; completedOrders: number;
}) {
  const d = config.design;
  const s = section.settings;
  const padding = s.padding === "compact" ? "48px 0" : s.padding === "spacious" ? "96px 0" : "72px 0";
  const bg = s.background || d.background;
  const align = s.align || "left";
  const cols = s.columns || 3;
  const button = s.showButton === false ? null : s.ctaLabel ? <a href={s.ctaHref || "#catalog"} style={buttonStyle(d, s.radius)}>{s.ctaLabel}</a> : null;
  const heading = s.heading || label(section.type);

  if (section.type === "hero") {
    // A template's own hero composition wins over the generic split / centered / fullbleed layouts.
    if (s.heroVariant) return <HeroVariantView variant={s.heroVariant} section={section} d={d} items={catalogItems} categories={categories} />;
    const heroStyle = s.heroStyle || "split";
    const eyebrowEl = (color: string) => s.eyebrow && <div style={{ color, fontSize: 12, fontWeight: 800, letterSpacing: ".12em", textTransform: "uppercase", marginBottom: 12 }}>{s.eyebrow}</div>;
    const h1Style: React.CSSProperties = { fontFamily: d.headingFont, fontSize: "clamp(40px,6vw,72px)", lineHeight: 1.03, margin: 0, letterSpacing: "-.04em" };
    const bodyEl = (color: string, a: "left" | "center" | "right") => s.body && <p style={{ color, maxWidth: 650, lineHeight: 1.75, fontSize: 16, margin: "22px 0 28px", marginLeft: a === "center" ? "auto" : 0, marginRight: a === "center" ? "auto" : 0 }}>{s.body}</p>;

    // Full-bleed: text over a full-width background (the image, or a brand gradient when there is none).
    if (heroStyle === "fullbleed") {
      const overlay = "linear-gradient(90deg, rgba(0,0,0,.66), rgba(0,0,0,.28))";
      const backdrop = s.image ? `${overlay}, url(${s.image}) center/cover` : `linear-gradient(135deg, ${d.primary}, ${d.primary} 55%, ${d.accent})`;
      return (
        <section id={section.id} className="bn-section" style={{ padding: s.padding === "compact" ? "96px 0" : "140px 0", background: backdrop, color: "#fff" }}>
          <div className="bn-wrap bn-hero" style={{ display: "grid", gridTemplateColumns: "1fr" }}>
            <div style={{ textAlign: align, maxWidth: 720, marginLeft: align === "center" ? "auto" : 0, marginRight: align === "center" ? "auto" : 0 }}>
              {eyebrowEl("rgba(255,255,255,.85)")}
              <h1 style={{ ...h1Style, color: "#fff" }}>{heading}</h1>
              {bodyEl("rgba(255,255,255,.88)", align)}
              {button}
            </div>
          </div>
        </section>
      );
    }

    // Centered: stacked and centred, image as a wide banner underneath.
    if (heroStyle === "centered") {
      return (
        <section id={section.id} className="bn-section" style={{ padding, background: bg }}>
          <div className="bn-wrap bn-hero" style={{ display: "grid", gridTemplateColumns: "1fr", gap: 44 }}>
            <div style={{ textAlign: "center" }}>
              {eyebrowEl(d.accent)}
              <h1 style={{ ...h1Style, maxWidth: 880, marginLeft: "auto", marginRight: "auto" }}>{heading}</h1>
              {bodyEl(d.muted, "center")}
              {button}
            </div>
            {s.image && <div style={{ minHeight: 380, borderRadius: s.radius ?? d.radius, background: `url(${s.image}) center/cover`, boxShadow: `0 30px 80px ${d.primary}22` }} />}
          </div>
        </section>
      );
    }

    // Split (default): text beside the image. Unchanged from before.
    return (
      <section id={section.id} className="bn-section" style={{ padding, background: bg }}>
        <div className="bn-wrap bn-hero" style={{ display: "grid", gridTemplateColumns: s.image ? "1.05fr .95fr" : "1fr", alignItems: "center", gap: 50 }}>
          <div style={{ textAlign: align }}>
            {eyebrowEl(d.accent)}
            <h1 style={h1Style}>{heading}</h1>
            {bodyEl(d.muted, align)}
            {button}
          </div>
          {s.image && <div style={{ minHeight: 440, borderRadius: s.radius ?? d.radius, background: `url(${s.image}) center/cover`, boxShadow: `0 30px 80px ${d.primary}22` }} />}
        </div>
      </section>
    );
  }

  if (section.type === "catalog") return (
    <section id={section.id} className="bn-section" style={{ padding, background: bg }}>
      <div className="bn-wrap"><SectionIntro section={section} config={config} />
        {catalogItems.length ? <div className="bn-grid" style={{ gridTemplateColumns: `repeat(${Math.min(cols,4)}, minmax(0,1fr))` }}>{catalogItems.map((item) => <ItemCard key={`${item.kind}-${item.id}`} item={item} store={store} d={d} radius={s.radius ?? d.radius} actionLabel={item.kind === "service" ? experience.primaryAction : "View product"} />)}</div> : <EmptyState text="Your published products and services will appear here." />}
      </div>
    </section>
  );

  if (section.type === "about" || section.type === "imageText") return (
    <section id={section.id} className="bn-section" style={{ padding, background: bg }}><div className="bn-wrap bn-hero" style={{ display: "grid", gridTemplateColumns: s.image ? "1fr 1fr" : "1fr", gap: 50, alignItems: "center" }}>
      <div><SectionIntro section={section} config={config} /><p style={{ color: d.muted, lineHeight: 1.8, maxWidth: 650 }}>{s.body || store.business.description}</p></div>
      {s.image && <div style={{ minHeight: 360, borderRadius: s.radius ?? d.radius, background: `url(${s.image}) center/cover` }} />}
    </div></section>
  );

  if (section.type === "stats") return <section id={section.id} className="bn-section" style={{ padding: "28px 0", background: bg }}><div className="bn-wrap bn-grid" style={{ gridTemplateColumns: "repeat(3,1fr)", textAlign: "center" }}><Stat value={`${catalogItems.length}+`} label={experience.mode === "commerce" ? "Published products" : experience.mode === "service" ? "Services" : "Products & services"} d={d} /><Stat value={completedOrders > 0 ? `${completedOrders}+` : "New"} label={experience.mode === "commerce" ? "Completed orders" : "Completed bookings"} d={d} /><Stat value={avgRating ? `${avgRating.toFixed(1)}/5` : "New"} label="Customer rating" d={d} /></div></section>;

  if (section.type === "features") return <section id={section.id} className="bn-section" style={{ padding, background: bg }}><div className="bn-wrap"><SectionIntro section={section} config={config} /><div className="bn-grid" style={{ gridTemplateColumns: `repeat(${Math.min(cols,4)},1fr)` }}>{["Quality you can trust", "Simple online ordering", "Responsive customer support", "Built for your business"].map((item, i) => <div key={item} style={{ padding: 24, background: d.surface, borderRadius: s.radius ?? d.radius, border: `1px solid ${d.text}12` }}><div style={{ color: d.accent, fontWeight: 900, fontSize: 12 }}>0{i + 1}</div><h3 style={{ margin: "10px 0 7px", fontFamily: d.headingFont, fontSize: 18 }}>{item}</h3><p style={{ color: d.muted, fontSize: 13, lineHeight: 1.7 }}>This section highlights a customer benefit configured by the business.</p></div>)}</div></div></section>;

  if (section.type === "categories") return <section id={section.id} className="bn-section" style={{ padding, background: bg }}><div className="bn-wrap"><SectionIntro section={section} config={config} /><div className="bn-grid" style={{ gridTemplateColumns: `repeat(${Math.min(cols,4)},1fr)` }}>{categories.map((c) => <a key={c} href={`/store/${store.slug}/search?q=${encodeURIComponent(c)}`} style={{ padding: 22, borderRadius: s.radius ?? d.radius, background: d.surface, border: `1px solid ${d.text}12`, fontWeight: 750 }}>{c}</a>)}</div></div></section>;

  if (section.type === "testimonials") return <section id={section.id} className="bn-section" style={{ padding, background: bg }}><div className="bn-wrap"><SectionIntro section={section} config={config} /><div className="bn-grid" style={{ gridTemplateColumns: `repeat(${Math.min(cols,3)},1fr)` }}>{reviews.length ? reviews.map((r) => <div key={r.id} style={{ background: d.surface, border: `1px solid ${d.text}12`, borderRadius: s.radius ?? d.radius, padding: 22 }}><div style={{ color: d.accent }}>{"★".repeat(r.rating)}{"☆".repeat(5-r.rating)}</div><p style={{ lineHeight: 1.7, color: d.muted }}>{r.comment}</p><strong style={{ fontSize: 13 }}>{r.author?.name || "Customer"}</strong></div>) : <EmptyState text="Customer reviews will appear here when you receive them." />}</div></div></section>;

  if (section.type === "newsletter") return <section id={section.id} className="bn-section" style={{ padding, background: s.background || d.primary, color: s.textColor || "#fff" }}><div className="bn-wrap" style={{ textAlign: "center" }}><SectionIntro section={section} config={config} inverse /><p style={{ opacity: .75, maxWidth: 560, margin: "0 auto 22px", lineHeight: 1.7 }}>{s.body || "Get occasional updates, new arrivals and offers."}</p><BuilderNewsletterForm storeSlug={store.slug} accent={d.accent} /></div></section>;

  if (section.type === "contact") return <section id={section.id} className="bn-section" style={{ padding, background: bg }}><div className="bn-wrap"><SectionIntro section={section} config={config} /><div className="bn-grid" style={{ gridTemplateColumns: "repeat(2,1fr)" }}>{store.contactEmail && <a href={`mailto:${store.contactEmail}`} style={{ padding: 24, background: d.surface, borderRadius: s.radius ?? d.radius }}><small style={{ color: d.muted }}>Email</small><div style={{ fontWeight: 750, marginTop: 5 }}>{store.contactEmail}</div></a>}{store.contactPhone && <a href={`tel:${store.contactPhone}`} style={{ padding: 24, background: d.surface, borderRadius: s.radius ?? d.radius }}><small style={{ color: d.muted }}>Phone</small><div style={{ fontWeight: 750, marginTop: 5 }}>{store.contactPhone}</div></a>}</div></div></section>;

  if (section.type === "gallery") return <section id={section.id} className="bn-section" style={{ padding, background: bg }}><div className="bn-wrap"><SectionIntro section={section} config={config} /><div className="bn-grid" style={{ gridTemplateColumns: `repeat(${Math.min(cols,4)},1fr)` }}>{catalogItems.slice(0,8).map((item) => <div key={item.id} style={{ aspectRatio: "1/1", borderRadius: s.radius ?? d.radius, background: item.image ? `url(${item.image}) center/cover` : d.surface }} />)}</div></div></section>;

  if (section.type === "map") return <section id={section.id} className="bn-section" style={{ padding, background: bg }}><div className="bn-wrap"><SectionIntro section={section} config={config} /><div style={{ minHeight: 280, borderRadius: s.radius ?? d.radius, background: `linear-gradient(135deg, ${d.primary}16, ${d.accent}18)`, display: "grid", placeItems: "center", color: d.muted }}>Add your location in Store Settings to show your map here.</div></div></section>;

  if (section.type === "faq" || section.type === "text") return <section id={section.id} className="bn-section" style={{ padding, background: bg }}><div className="bn-wrap" style={{ maxWidth: section.type === "faq" ? 850 : 1160 }}>{section.type === "faq" ? <><SectionIntro section={section} config={config} /><details style={{ borderTop: `1px solid ${d.text}14`, padding: "18px 0" }}><summary style={{ cursor: "pointer", fontWeight: 750 }}>{experience.mode === "commerce" ? "How do I place an order?" : "How do I book a service?"}</summary><p style={{ color: d.muted, lineHeight: 1.7 }}>Browse the business website, choose what you need, and follow the purchase or booking instructions.</p></details><details style={{ borderTop: `1px solid ${d.text}14`, padding: "18px 0" }}><summary style={{ cursor: "pointer", fontWeight: 750 }}>How can I contact this business?</summary><p style={{ color: d.muted, lineHeight: 1.7 }}>{store.contactEmail || store.contactPhone || "Use the contact section on this store."}</p></details></> : <><SectionIntro section={section} config={config} /><p style={{ color: d.muted, lineHeight: 1.8, whiteSpace: "pre-wrap" }}>{s.body}</p></>}</div></section>;

  return null;
}

function SectionIntro({ section, config, inverse = false }: { section: BuilderSection; config: BuilderConfig; inverse?: boolean }) {
  const d = config.design, s = section.settings;
  return <div style={{ marginBottom: 30, textAlign: s.align || "left" }}>
    {s.eyebrow && <div style={{ color: d.accent, fontSize: 11, fontWeight: 800, letterSpacing: ".12em", textTransform: "uppercase", marginBottom: 8 }}>{s.eyebrow}</div>}
    <h2 style={{ fontFamily: d.headingFont, fontSize: "clamp(28px,4vw,46px)", lineHeight: 1.08, letterSpacing: "-.035em", margin: 0, color: inverse ? "#fff" : d.text }}>{s.heading || label(section.type)}</h2>
    {s.body && <p style={{ color: inverse ? "rgba(255,255,255,.72)" : d.muted, lineHeight: 1.7, maxWidth: 650, marginTop: 12 }}>{s.body}</p>}
  </div>;
}

function label(type: string) { return ({ hero: "Welcome", catalog: "Shop", about: "About us", stats: "At a glance", features: "Why choose us", categories: "Categories", testimonials: "Testimonials", newsletter: "Newsletter", contact: "Contact", gallery: "Gallery", map: "Location", faq: "FAQ", text: "More about us", imageText: "Our story" } as Record<string,string>)[type] || "Section"; }
function buttonStyle(d: BuilderConfig["design"], radius?: number, inverse = false): React.CSSProperties { return { display: "inline-block", padding: "12px 20px", borderRadius: d.buttonStyle === "pill" ? 999 : radius ?? d.radius, background: d.buttonStyle === "outline" ? "transparent" : (inverse ? "#fff" : d.primary), color: inverse ? d.primary : (d.buttonStyle === "outline" ? d.primary : "#fff"), fontWeight: 800, fontSize: 13, border: d.buttonStyle === "outline" ? `1px solid ${inverse ? "#fff" : d.primary}` : "none" }; }
function Stat({ value, label, d }: { value: string; label: string; d: BuilderConfig["design"] }) { return <div><div style={{ fontFamily: d.headingFont, fontSize: 30, fontWeight: 800 }}>{value}</div><div style={{ color: d.muted, fontSize: 12 }}>{label}</div></div>; }
function EmptyState({ text }: { text: string }) { return <div style={{ padding: 28, border: "1px dashed currentColor", opacity: .6, borderRadius: 12, gridColumn: "1/-1" }}>{text}</div>; }


/* ───────────── Structural variants: each template picks its own header / footer / card ───────────── */
type DesignT = BuilderConfig["design"];
type SectionT = BuilderConfig["sections"][number];

export function BuilderHeader({ store, d, experience, visible }: { store: BuilderStore; d: DesignT; experience: ReturnType<typeof getBusinessExperience>; visible: SectionT[] }) {
  const style = d.headerStyle ?? "classic";
  const mark = store.logoUrl
    ? <img src={store.logoUrl} alt="" style={{ width: 36, height: 36, borderRadius: Math.min(d.radius, 12), objectFit: "cover" }} />
    : <span style={{ width: 36, height: 36, borderRadius: Math.min(d.radius, 12), background: d.primary, display: "grid", placeItems: "center", color: "#fff" }}>{store.name.slice(0, 1).toUpperCase()}</span>;
  const brand = <Link href={`/store/${store.slug}`} style={{ display: "flex", alignItems: "center", gap: 10, fontWeight: 800, fontFamily: d.headingFont }}>{mark}{store.name}</Link>;
  // Default header menu (used until the owner builds one in Dashboard > Menus). It used to list only the
  // homepage sections that happened to exist, so a simple store showed a single "Featured Products" link.
  const defaultMenu: FallbackLink[] = [
    ["Home", "/"],
    [experience.mode === "service" ? "Services" : "Shop", "/catalog"],
    ...(experience.mode === "service" ? [] : ([["Categories", "/categories"]] as FallbackLink[])),
    ["About", "/about"],
    ["Contact", "/contact"],
  ];
  const links = <MenuLinks slug={store.slug} fallback={defaultMenu} />;

  // Phones: the inline links are hidden below 720px, so a menu button opens a full-screen sheet instead.
  const [menuOpen, setMenuOpen] = useState(false);
  useEffect(() => {
    if (!menuOpen) return;
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") setMenuOpen(false); };
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    window.addEventListener("keydown", onKey);
    return () => { document.body.style.overflow = prev; window.removeEventListener("keydown", onKey); };
  }, [menuOpen]);
  const sheetLink: React.CSSProperties = { display: "block", padding: "16px 0", fontSize: 24, fontFamily: d.headingFont, fontWeight: 650, borderBottom: `1px solid ${d.text}14`, color: d.text, textDecoration: "none" };
  const mobile = (
    <>
      <style>{`.bn-menu-btn{display:none}@media(max-width:720px){.bn-menu-btn{display:inline-grid!important}}`}</style>
      <button type="button" className="bn-menu-btn" aria-label="Open menu" aria-expanded={menuOpen} onClick={() => setMenuOpen(true)} style={{ width: 40, height: 40, placeItems: "center", border: 0, background: "transparent", color: "inherit", cursor: "pointer" }}>
        <svg width="22" height="22" viewBox="0 0 22 22" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden><path d="M3 6h16M3 11h16M3 16h16" /></svg>
      </button>
      {menuOpen && typeof document !== "undefined" && createPortal(
        <div role="dialog" aria-modal="true" aria-label="Menu" style={{ position: "fixed", inset: 0, zIndex: 100, background: d.background, color: d.text, fontFamily: d.font, padding: "16px 22px 32px", overflowY: "auto" }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 18 }}>
            <strong style={{ fontFamily: d.headingFont, fontSize: 18 }}>{store.name}</strong>
            <button type="button" aria-label="Close menu" onClick={() => setMenuOpen(false)} style={{ width: 40, height: 40, border: 0, background: "transparent", color: "inherit", cursor: "pointer", display: "grid", placeItems: "center" }}>
              <svg width="22" height="22" viewBox="0 0 22 22" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden><path d="M4 4l14 14M18 4L4 18" /></svg>
            </button>
          </div>
          <nav><MenuLinks slug={store.slug} fallback={defaultMenu} linkStyle={sheetLink} onNavigate={() => setMenuOpen(false)} /></nav>
        </div>,
        document.body,
      )}
    </>
  );
  const cart = experience.mode !== "service" ? <CartLink storeSlug={store.slug} accent={d.accent} /> : null;
  const linkRow = (justify: string): React.CSSProperties => ({ display: "flex", gap: 22, fontSize: 13, color: d.muted, justifyContent: justify });

  if (style === "centered") return (
    <nav style={{ borderBottom: `1px solid ${d.text}14`, background: d.background, position: "sticky", top: 0, zIndex: 20 }}>
      <div className="bn-wrap" style={{ padding: "14px 0 10px", display: "grid", gridTemplateColumns: "1fr auto 1fr", alignItems: "center", gap: 12 }}>
        <div className="bn-nav-links" style={linkRow("flex-start")}>{links}</div>
        <div style={{ fontSize: 20, textAlign: "center" }}>{brand}</div>
        <div style={{ display: "flex", justifyContent: "flex-end" }}>{cart}{mobile}</div>
      </div>
    </nav>
  );
  if (style === "stripe") return (
    <nav style={{ position: "sticky", top: 0, zIndex: 20, background: d.primary, color: "#fff", borderBottom: `3px solid ${d.accent}` }}>
      <div className="bn-wrap" style={{ height: 60, display: "grid", gridTemplateColumns: "auto 1fr auto", alignItems: "center", gap: 28 }}>
        <Link href={`/store/${store.slug}`} style={{ display: "flex", alignItems: "center", gap: 10, fontWeight: 900, fontFamily: d.headingFont, letterSpacing: "-.02em", textTransform: "uppercase" }}>
          {store.logoUrl
            ? <img src={store.logoUrl} alt="" style={{ width: 32, height: 32, objectFit: "cover", borderRadius: 2 }} />
            : <span style={{ width: 32, height: 32, background: d.accent, color: "#111", display: "grid", placeItems: "center", borderRadius: 2 }}>{store.name.slice(0, 1).toUpperCase()}</span>}
          {store.name}
        </Link>
        <div className="bn-nav-links" style={{ ...linkRow("flex-end"), color: "rgba(255,255,255,.78)", fontWeight: 700 }}>{links}</div>
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>{cart}{mobile}</div>
      </div>
    </nav>
  );
  if (style === "overlay") return (
    <div style={{ position: "sticky", top: 12, zIndex: 20, padding: "12px 0 0" }}>
      <nav className="bn-wrap" style={{ background: `${d.background}f2`, border: `1px solid ${d.text}14`, borderRadius: 999, boxShadow: "0 10px 30px rgba(0,0,0,.12)", backdropFilter: "blur(14px)", padding: "0 22px", height: 58, display: "flex", alignItems: "center", justifyContent: "space-between", gap: 18 }}>
        {brand}
        <div className="bn-nav-links" style={linkRow("center")}>{links}</div>
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>{cart}{mobile}</div>
      </nav>
    </div>
  );
  if (style === "bar") return (
    <div style={{ position: "sticky", top: 0, zIndex: 20 }}>
      <div style={{ background: d.primary, color: "#fff", fontSize: 12, padding: "8px 0" }}>
        <div className="bn-wrap" style={{ display: "flex", justifyContent: "space-between", gap: 12, flexWrap: "wrap" }}>
          <span style={{ opacity: .9 }}>{store.business?.description ? String(store.business.description).slice(0, 70) : `Welcome to ${store.name}`}</span>
          <span style={{ opacity: .8 }}>{store.contactPhone || store.contactEmail || ""}</span>
        </div>
      </div>
      <nav style={{ borderBottom: `1px solid ${d.text}14`, background: d.background }}>
        <div className="bn-wrap" style={{ height: 64, display: "flex", alignItems: "center", justifyContent: "space-between", gap: 18 }}>
          {brand}<div className="bn-nav-links" style={linkRow("center")}>{links}</div><div style={{ display: "flex", alignItems: "center", gap: 10 }}>{cart}{mobile}</div>
        </div>
      </nav>
    </div>
  );
  return (
    <nav style={{ borderBottom: `1px solid ${d.text}14`, background: d.background, position: "sticky", top: 0, zIndex: 20, backdropFilter: "blur(14px)" }}>
      <div className="bn-wrap" style={{ height: 70, display: "flex", alignItems: "center", justifyContent: "space-between", gap: 18 }}>
        {brand}<div className="bn-nav-links" style={linkRow("flex-start")}>{links}</div><div style={{ display: "flex", alignItems: "center", gap: 10 }}>{cart}{mobile}</div>
      </div>
    </nav>
  );
}

export function BuilderFooter({ store, d, visible, storeLinks }: { store: BuilderStore; d: DesignT; visible: SectionT[]; storeLinks?: { label: string; href: string }[] }) {
  const style = d.footerStyle ?? "columns";
  const year = new Date().getFullYear();
  const desc = store.business?.description || "Built with BizNest.";
  const contact = store.contactEmail || store.contactPhone || "Online business";
  const anchors = visible.filter((s) => ["catalog", "about", "contact", "testimonials", "features"].includes(s.type)).slice(0, 5);
  const navLinks = storeLinks ?? anchors.map((s) => ({ label: s.settings.heading || label(s.type), href: `#${s.id}` }));
  const link = { color: "inherit", opacity: .78, fontSize: 13 } as React.CSSProperties;
  const base: React.CSSProperties = { marginTop: 60, background: d.primary, color: "#fff" };

  if (style === "minimal") return (
    <footer style={{ ...base, padding: "22px 0" }}>
      <div className="bn-wrap" style={{ display: "flex", justifyContent: "space-between", gap: 12, flexWrap: "wrap", fontSize: 13 }}>
        <strong style={{ fontFamily: d.headingFont }}>{store.name}</strong><span style={{ opacity: .7 }}>© {year} · {contact}</span>
      </div>
    </footer>
  );
  if (style === "centered") return (
    <footer style={{ ...base, padding: "56px 0 28px", textAlign: "center" }}>
      <div className="bn-wrap">
        <strong style={{ fontSize: 24, fontFamily: d.headingFont }}>{store.name}</strong>
        <p style={{ opacity: .72, maxWidth: 520, margin: "12px auto 20px", lineHeight: 1.7, fontSize: 13 }}>{desc}</p>
        <div style={{ display: "flex", justifyContent: "center", gap: 24, flexWrap: "wrap", marginBottom: 24 }}>{navLinks.map((l) => <a key={l.label} href={l.href} style={link}>{l.label}</a>)}</div>
        <div style={{ borderTop: "1px solid rgba(255,255,255,.14)", paddingTop: 18, fontSize: 12, opacity: .6 }}>© {year} {store.name} · {contact}</div>
      </div>
    </footer>
  );
  if (style === "cta") return (
    <>
      <section style={{ marginTop: 60, background: d.accent, color: "#fff", padding: "56px 0", textAlign: "center" }}>
        <div className="bn-wrap">
          <h2 style={{ margin: 0, fontSize: 34, fontFamily: d.headingFont }}>Ready when you are.</h2>
          <p style={{ opacity: .9, margin: "10px 0 22px" }}>Browse {store.name} and order in minutes.</p>
          <a href={storeLinks?.[1]?.href ?? "#catalog"} style={{ display: "inline-block", background: "#fff", color: d.primary, padding: "13px 26px", borderRadius: d.buttonStyle === "pill" ? 999 : d.radius, fontWeight: 800, fontSize: 14 }}>Start now →</a>
        </div>
      </section>
      <footer style={{ background: d.primary, color: "#fff", padding: "22px 0" }}>
        <div className="bn-wrap" style={{ display: "flex", justifyContent: "space-between", gap: 12, flexWrap: "wrap", fontSize: 13, opacity: .85 }}>
          <strong>{store.name}</strong><span>{contact}</span><span>© {year}</span>
        </div>
      </footer>
    </>
  );
  return (
    <footer style={{ ...base, padding: "56px 0 24px" }}>
      <div className="bn-wrap">
        <div style={{ display: "grid", gridTemplateColumns: "2fr 1fr 1.2fr", gap: 36 }} className="bn-grid">
          <div><strong style={{ fontSize: 22, fontFamily: d.headingFont }}>{store.name}</strong><p style={{ opacity: .72, maxWidth: 380, lineHeight: 1.7, fontSize: 13 }}>{desc}</p></div>
          <div style={{ display: "flex", flexDirection: "column", gap: 10 }}><b style={{ fontSize: 12, letterSpacing: ".14em", textTransform: "uppercase" }}>Explore</b>{navLinks.map((l) => <a key={l.label} href={l.href} style={link}>{l.label}</a>)}</div>
          <div style={{ display: "flex", flexDirection: "column", gap: 10 }}><b style={{ fontSize: 12, letterSpacing: ".14em", textTransform: "uppercase" }}>Contact</b><span style={link}>{store.contactEmail || "—"}</span><span style={link}>{store.contactPhone || ""}</span></div>
        </div>
        <div style={{ borderTop: "1px solid rgba(255,255,255,.14)", marginTop: 36, paddingTop: 18, fontSize: 12, opacity: .6 }}>© {year} {store.name}. All rights reserved.</div>
      </div>
    </footer>
  );
}

export function ItemCard({ item, store, d, radius, actionLabel }: { item: CatalogItem; store: BuilderStore; d: DesignT; radius: number; actionLabel: string }) {
  const style = d.cardStyle ?? "bordered";
  const href = `/store/${store.slug}/${item.kind}/${item.id}`;
  const price = `${item.currency} ${item.price.toLocaleString()}`;
  const img = (ratio: string, r: number | string = 0): React.CSSProperties => ({ aspectRatio: ratio, borderRadius: r, background: item.image ? `url(${item.image}) center/cover` : `${d.primary}12` });
  if (style === "overlay") return (
    <Link href={href} style={{ position: "relative", display: "block", borderRadius: radius, overflow: "hidden" }}>
      <div style={img("4/5")} />
      <div style={{ position: "absolute", inset: "auto 0 0 0", padding: 16, color: "#fff", background: "linear-gradient(0deg,rgba(0,0,0,.78),rgba(0,0,0,0))" }}>
        <div style={{ fontWeight: 750, fontFamily: d.headingFont }}>{item.name}</div>
        <div style={{ fontWeight: 800, marginTop: 4, color: d.accent }}>{price}</div>
      </div>
    </Link>
  );
  if (style === "minimal") return (
    <Link href={href} style={{ display: "block" }}>
      <div style={img("1/1", radius)} />
      <div style={{ paddingTop: 12, display: "flex", justifyContent: "space-between", gap: 10, alignItems: "baseline" }}>
        <span style={{ fontWeight: 650 }}>{item.name}</span><span style={{ color: d.muted, fontSize: 13, whiteSpace: "nowrap" }}>{price}</span>
      </div>
    </Link>
  );
  if (style === "tall") return (
    <Link href={href} style={{ display: "block", textAlign: "center" }}>
      <div style={img("3/4", radius)} />
      <div style={{ paddingTop: 14, fontSize: 12, letterSpacing: ".14em", textTransform: "uppercase", fontWeight: 700 }}>{item.name}</div>
      <div style={{ color: d.accent, fontWeight: 800, marginTop: 4 }}>{price}</div>
    </Link>
  );
  return (
    <Link href={href} style={{ border: `1px solid ${d.text}12`, borderRadius: radius, overflow: "hidden", background: d.surface }}>
      <div style={img("1/1")} />
      <div style={{ padding: 16 }}>
        <div style={{ fontWeight: 750, marginBottom: 7 }}>{item.name}</div>
        <div style={{ color: d.accent, fontWeight: 800 }}>{price}</div>
        <div style={{ marginTop: 10, fontSize: 11, color: d.muted, fontWeight: 700 }}>{actionLabel} →</div>
      </div>
    </Link>
  );
}
