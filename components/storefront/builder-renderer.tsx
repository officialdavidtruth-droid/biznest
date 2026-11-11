"use client";

import { starFill, starEmpty } from "@/lib/utils/stars";
import { nicheHeroPhoto, nicheSamplePhoto } from "@/lib/niche-imagery";
import { readableAccentText } from "@/lib/utils/readable-accent";
import { MenuLinks, useFooterMenu, type FallbackLink } from "@/components/storefront/store-menu";
import { useStoreCategories } from "@/components/storefront/store-categories";
import { BuilderDepartures } from "@/components/storefront/builder-departures";
import type { PublicTravelPackage } from "@/lib/travel-public";
import type React from "react";
import { Fragment, useEffect, useMemo, useState } from "react";
import { createPortal } from "react-dom";
import Link from "next/link";
import { CartLink } from "@/components/storefront/cart-link";
import { AccountLink } from "@/components/storefront/account-link";
import { BuilderNewsletterForm } from "@/components/storefront/builder-newsletter-form";
import { cssUrl, fontStack, isSafeImageUrl, safeHref } from "@/lib/builder-safe";
import { readBuilderConfig, type BuilderConfig, type BuilderSection } from "@/lib/builder-config";
import { getBusinessExperience } from "@/lib/business-experience";
import { HeroVariantView } from "@/components/storefront/hero-variants";
import { formatNumber } from "@/lib/i18n/locale";
import { ownText, mapDirectionsUrl, mapEmbedUrl, mapQuery, whatsappLink } from "@/lib/builder-defaults";
import type { BuilderSectionItem } from "@/lib/builder-config";

type CatalogItem = {
  id: string; kind: "product" | "service"; name: string; price: number; currency: string;
  image: string | null; categoryName: string | null;
};

type Review = { id: string; rating: number; comment: string | null; author: { name: string | null } | null };

type BuilderStore = {
  name: string; slug: string; logoUrl: string | null; bannerUrl?: string | null; contactEmail: string | null; contactPhone: string | null; whatsappNumber?: string | null;
  business: { description: string | null; category?: string | null; businessSubcategory?: string | null; sellsProducts?: boolean; offersServices?: boolean; city?: string | null; state?: string | null; country?: string | null };
};

/**
 * True only inside the Customize preview: the page is framed AND the frame's parent is this same site.
 * (A store embedded in some other website is framed too, but cross-origin, and must keep working normally.)
 */
function isInOwnPreview(): boolean {
  try {
    if (window.self === window.top) return false;
    return window.parent.location.origin === window.location.origin;
  } catch {
    return false;
  }
}

export function BuilderStorefront({
  store, config: initialConfig, catalogItems, reviews, avgRating, completedOrders, fallbackFaq, categoryList, departures,
}: {
  store: BuilderStore;
  config: BuilderConfig;
  catalogItems: CatalogItem[];
  reviews: Review[];
  avgRating: number | null;
  completedOrders: number;
  /** The store's own FAQ (e.g. written by the AI store builder), shown when the FAQ section has no entries of its own. */
  fallbackFaq?: BuilderSectionItem[];
  /** The owner's real categories (Dashboard > Categories), empty ones included. Without it, categories are read off the items. */
  categoryList?: { id: string; name: string; slug?: string | null }[];
  /** Open group departures from BizNest Travel. Drawn after the catalog only when the agency has some. */
  departures?: PublicTravelPackage[];
}) {
  const [liveConfig, setLiveConfig] = useState<BuilderConfig>(initialConfig);
  // True only when this storefront is rendered inside the customizer's
  // preview iframe (see components/dashboard/customizer-client.tsx) — never
  // on the real, live storefront a customer visits at /store/[slug].
  const [isEditMode, setIsEditMode] = useState(false);

  useEffect(() => {
    setIsEditMode(isInOwnPreview());
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
      if (!isInOwnPreview()) return; // a normal visitor's page never takes layout updates from a message
      if (event.source !== window.parent) return;
      if (event.origin !== window.location.origin) return;
      const data = event.data;
      if (!data || data.type !== "BIZNEST_CUSTOMIZER_PREVIEW") return;
      const draft = readBuilderConfig(data.config);
      if (draft) setLiveConfig(draft); // a half-typed value that fails validation keeps the last good preview
    }

    window.addEventListener("message", handleMessage);
    return () => window.removeEventListener("message", handleMessage);
  }, []);

  const d = useMemo(() => ({ ...liveConfig.design, font: fontStack(liveConfig.design.font), headingFont: fontStack(liveConfig.design.headingFont) }), [liveConfig.design]);
  const config = useMemo(() => ({ ...liveConfig, design: d }), [liveConfig, d]); // used by JSX below (BuilderSectionView expects `config`)
  const experience = getBusinessExperience(store.business.category, { sellsProducts: store.business.sellsProducts, offersServices: store.business.offersServices }, store.business.businessSubcategory);
  const width = d.containerWidth === "compact" ? 960 : d.containerWidth === "wide" ? 1320 : 1160;
  // A hero with no image of its own shows the store's banner (Customize > Content > Background image),
  // so changing that image updates a published builder homepage instead of being ignored.
  const visible = config.sections.filter((s) => s.visible).map((s) => s.type === "hero" && !s.settings.image && store.bannerUrl && isSafeImageUrl(store.bannerUrl) ? { ...s, settings: { ...s.settings, image: store.bannerUrl } } : s.type === "hero" && !s.settings.image && !store.bannerUrl && nicheHeroPhoto(store.business.category) ? { ...s, settings: { ...s.settings, image: nicheHeroPhoto(store.business.category)! } } : s)
    // Only the owner's own words reach visitors: platform filler text is dropped.
    .map((s) => (s.settings.body && !ownText(s.settings.body) ? { ...s, settings: { ...s.settings, body: undefined } } : s));
  const featured = catalogItems.slice(0, 8);
  // Departures sit right after the catalog; a layout with no catalog shows them after its first section.
  const departuresAnchor = (visible.find((s) => s.type === "catalog") ?? visible[0])?.id;
  const categories = Array.from(new Set(catalogItems.map((i) => i.categoryName).filter(Boolean))) as string[];
  // Owner's categories first (so a store with categories but no items still shows them), else the ones its items name.
  const realCategories = (categoryList ?? []).filter((c) => c.id && !String(c.id).startsWith("cat-"));
  const imageOf = (name: string) => catalogItems.find((i) => i.categoryName === name && i.image)?.image ?? null;
  const categoryLinks = realCategories.length
    ? realCategories.map((c) => ({ name: c.name, href: `/store/${store.slug}/category/${c.slug || c.id}`, image: imageOf(c.name) }))
    : categories.map((c) => ({ name: c, href: `/store/${store.slug}/search?q=${encodeURIComponent(c)}`, image: imageOf(c) }));

  // Every rendered section carries a plain `id={section.id}` (see
  // BuilderSectionView below) and nothing else in this component sets an
  // `id` attribute, so the nearest ancestor with an id is always the
  // clicked section. Only active in the customizer's preview iframe —
  // intercepting/preventing normal link navigation on the real storefront
  // would break the actual customer experience.
  function handleSectionClick(e: React.MouseEvent) {
    if (!isEditMode) {
      // Template-generated sections get ids like "catalog-2", but default button
      // links point at "#catalog". When no element has that exact id, scroll to
      // the first section of that type instead of silently doing nothing.
      const anchor = (e.target as HTMLElement).closest?.("a[href^='#']") as HTMLAnchorElement | null;
      const hash = anchor?.getAttribute("href")?.slice(1);
      if (anchor && hash && !document.getElementById(hash)) {
        const match = document.querySelector(`[data-bn-type="${CSS.escape(hash)}"]`);
        if (match) { e.preventDefault(); match.scrollIntoView({ behavior: "smooth", block: "start" }); }
      }
      return;
    }
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
      <style>{`a{text-decoration:none;color:inherit}.bn-wrap{width:min(${width}px,calc(100% - 32px));margin:0 auto}.bn-grid{display:grid;gap:20px}@media(max-width:720px){.bn-grid{grid-template-columns:1fr!important}.bn-grid.bn-g2{grid-template-columns:repeat(2,minmax(0,1fr))!important;gap:12px!important}.bn-hero{grid-template-columns:1fr!important}.bn-section{padding-top:56px!important;padding-bottom:56px!important}.bn-nav-links{display:none!important}}.bn-itemimg{transition:transform .5s cubic-bezier(.16,1,.3,1)}.bn-itemcard:hover .bn-itemimg{transform:scale(1.06)}.bn-itemcard{transition:box-shadow .3s ease,transform .3s ease}.bn-itemcard:hover{box-shadow:0 18px 40px -22px rgba(0,0,0,.35);transform:translateY(-3px)}@media(prefers-reduced-motion:reduce){.bn-itemimg,.bn-itemcard{transition:none!important}.bn-itemcard:hover,.bn-itemcard:hover .bn-itemimg{transform:none!important}}${isEditMode ? `.bn-section{cursor:pointer;transition:outline .12s ease}.bn-section:hover{outline:2px dashed ${d.accent};outline-offset:-2px}` : ""}`}</style>
      <BuilderHeader store={store} d={d} experience={experience} visible={visible} />

      {visible.map((section) => <Fragment key={section.id}><BuilderSectionView section={section} store={store} config={config} catalogItems={featured} categories={categories} categoryLinks={categoryLinks} experience={experience} reviews={reviews} avgRating={avgRating} completedOrders={completedOrders} fallbackFaq={fallbackFaq} isEditMode={isEditMode} catalogTotal={catalogItems.length} />{section.id === departuresAnchor && departures?.length ? <BuilderDepartures slug={store.slug} packages={departures} d={d} /> : null}</Fragment>)}

      <BuilderFooter store={store} d={d} visible={visible} />
    </main>
  );
}

function BuilderSectionView({ section, store, config, catalogItems, categories, categoryLinks, experience, reviews, avgRating, completedOrders, fallbackFaq, isEditMode, catalogTotal }: {
  section: BuilderSection; store: BuilderStore; config: BuilderConfig; catalogItems: CatalogItem[]; categories: string[]; categoryLinks: { name: string; href: string; image?: string | null }[]; experience: ReturnType<typeof getBusinessExperience>; reviews: Review[]; avgRating: number | null; completedOrders: number; fallbackFaq?: BuilderSectionItem[]; isEditMode?: boolean; catalogTotal?: number;
}) {
  const d = config.design;
  const s = section.settings;
  const padding = s.padding === "compact" ? "48px 0" : s.padding === "spacious" ? "96px 0" : "72px 0";
  const bg = s.background || d.background;
  const align = s.align || "left";
  const cols = s.columns || 3;
  const button = s.showButton === false ? null : s.ctaLabel ? <a href={safeHref(s.ctaHref, "#catalog")} style={buttonStyle(d, s.radius)}>{s.ctaLabel}</a> : null;
  const heading = s.heading || label(section.type);

  if (section.type === "hero") {
    // A template's own hero composition wins over the generic split / centered / fullbleed layouts.
    if (s.heroVariant) return <HeroVariantView variant={s.heroVariant} section={section} d={d} items={catalogItems} categories={categories} slug={store.slug} />;
    const heroStyle = s.heroStyle || "split";
    const eyebrowEl = (color: string) => s.eyebrow && <div style={{ color, fontSize: 12, fontWeight: 800, letterSpacing: ".12em", textTransform: "uppercase", marginBottom: 12 }}>{s.eyebrow}</div>;
    const h1Style: React.CSSProperties = { fontFamily: d.headingFont, fontSize: "clamp(40px,6vw,72px)", lineHeight: 1.03, margin: 0, letterSpacing: "-.04em" };
    const bodyEl = (color: string, a: "left" | "center" | "right") => s.body && <p style={{ color, maxWidth: 650, lineHeight: 1.75, fontSize: 16, margin: "22px 0 28px", marginLeft: a === "center" ? "auto" : 0, marginRight: a === "center" ? "auto" : 0 }}>{s.body}</p>;

    // Full-bleed: text over a full-width background (the image, or a brand gradient when there is none).
    if (heroStyle === "fullbleed") {
      const overlay = "linear-gradient(90deg, rgba(0,0,0,.66), rgba(0,0,0,.28))";
      const backdrop = s.image ? `${overlay}, url(${cssUrl(s.image)}) center/cover` : `linear-gradient(135deg, ${d.primary}, ${d.primary} 55%, ${d.accent})`;
      return (
        <section id={section.id} data-bn-type={section.type} className="bn-section" style={{ padding: s.padding === "compact" ? "96px 0" : "140px 0", background: backdrop, color: "#fff" }}>
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
    if (heroStyle === "centered" && s.image) {
      // With a photo, the photo is the hero: full-bleed behind centred text so it is visible above the fold.
      const inverseButton = s.showButton === false ? null : s.ctaLabel ? <a href={safeHref(s.ctaHref, "#catalog")} style={buttonStyle(d, s.radius, true)}>{s.ctaLabel}</a> : null;
      return (
        <section id={section.id} data-bn-type={section.type} className="bn-section" style={{ padding: s.padding === "compact" ? "110px 0" : "150px 0", background: `linear-gradient(180deg, rgba(0,0,0,.42), rgba(0,0,0,.62)), url(${cssUrl(s.image)}) center/cover`, color: "#fff" }}>
          <div className="bn-wrap bn-hero" style={{ display: "grid", gridTemplateColumns: "1fr" }}>
            <div style={{ textAlign: "center" }}>
              {eyebrowEl("rgba(255,255,255,.85)")}
              <h1 style={{ ...h1Style, color: "#fff", maxWidth: 880, marginLeft: "auto", marginRight: "auto" }}>{heading}</h1>
              {bodyEl("rgba(255,255,255,.9)", "center")}
              {inverseButton}
            </div>
          </div>
        </section>
      );
    }

    if (heroStyle === "centered") {
      return (
        <section id={section.id} data-bn-type={section.type} className="bn-section" style={{ padding, background: bg }}>
          <div className="bn-wrap bn-hero" style={{ display: "grid", gridTemplateColumns: "1fr", gap: 44 }}>
            <div style={{ textAlign: "center" }}>
              {eyebrowEl(d.accent)}
              <h1 style={{ ...h1Style, maxWidth: 880, marginLeft: "auto", marginRight: "auto" }}>{heading}</h1>
              {bodyEl(d.muted, "center")}
              {button}
            </div>
            {s.image && <div style={{ minHeight: 380, borderRadius: s.radius ?? d.radius, background: `url(${cssUrl(s.image)}) center/cover`, boxShadow: `0 30px 80px ${d.primary}22` }} />}
          </div>
        </section>
      );
    }

    // Split (default): text beside the image. Unchanged from before.
    return (
      <section id={section.id} data-bn-type={section.type} className="bn-section" style={{ padding, background: bg }}>
        <div className="bn-wrap bn-hero" style={{ display: "grid", gridTemplateColumns: s.image ? "1.05fr .95fr" : "1fr", alignItems: "center", gap: 50 }}>
          <div style={{ textAlign: align }}>
            {eyebrowEl(d.accent)}
            <h1 style={h1Style}>{heading}</h1>
            {bodyEl(d.muted, align)}
            {button}
          </div>
          {s.image && <div style={{ minHeight: 440, borderRadius: s.radius ?? d.radius, background: `url(${cssUrl(s.image)}) center/cover`, boxShadow: `0 30px 80px ${d.primary}22` }} />}
        </div>
      </section>
    );
  }

  // Nothing to show: leave the section out on the live site (the editor still shows it so it can be filled in).
  if (section.type === "catalog" && !catalogItems.length && !isEditMode) return null;
  if (section.type === "catalog") return (
    <section id={section.id} data-bn-type={section.type} className="bn-section" style={{ padding, background: bg }}>
      <div className="bn-wrap"><SectionIntro section={section} config={config} />
        {catalogItems.length ? (() => {
          const label = (item: CatalogItem) => (item.kind === "service" ? experience.primaryAction : "View product");
          const rad = s.radius ?? d.radius;
          const href = (item: CatalogItem) => `/store/${store.slug}/${item.kind}/${item.id}`;
          const price = (item: CatalogItem) => `${item.currency} ${formatNumber(item.price)}`;
          if (s.style === "list") return <div style={{ display: "grid", gap: 12 }}>{catalogItems.map((item) => <Link key={`${item.kind}-${item.id}`} href={href(item)} style={{ display: "grid", gridTemplateColumns: "104px 1fr auto", alignItems: "center", gap: 18, padding: 12, borderRadius: rad, background: d.surface, border: `1px solid ${d.text}10` }}><span aria-hidden style={{ aspectRatio: "1/1", borderRadius: Math.max(rad - 4, 6), background: item.image ? `url(${cssUrl(item.image)}) center/cover` : `${d.primary}12` }} /><span style={{ minWidth: 0 }}>{item.categoryName && <span style={{ display: "block", fontSize: 11, color: d.muted, fontWeight: 700, letterSpacing: ".06em", textTransform: "uppercase", marginBottom: 3 }}>{item.categoryName}</span>}<span style={{ display: "block", fontWeight: 780, fontSize: 17, fontFamily: d.headingFont }}>{item.name}</span><span style={{ display: "block", marginTop: 4, color: readableAccentText(d.accent, d.surface), fontWeight: 800 }}>{price(item)}</span></span><span style={{ padding: "10px 16px", borderRadius: d.buttonStyle === "pill" ? 999 : Math.min(rad, 12), background: d.primary, color: "#fff", fontWeight: 800, fontSize: 13, whiteSpace: "nowrap" }}>{label(item)}</span></Link>)}</div>;
          if (s.style === "rail") return <div style={{ display: "flex", gap: 18, overflowX: "auto", scrollSnapType: "x mandatory", paddingBottom: 14, margin: "0 -4px", paddingLeft: 4 }}>{catalogItems.map((item) => <div key={`${item.kind}-${item.id}`} style={{ flex: "0 0 min(280px,72vw)", scrollSnapAlign: "start" }}><ItemCard item={item} store={store} d={d} radius={rad} actionLabel={label(item)} /></div>)}</div>;
          if (s.style === "feature" && catalogItems.length >= 3) {
            const [first, ...rest] = catalogItems;
            return <div className="bn-grid" style={{ gridTemplateColumns: "1.15fr 1fr 1fr", gridAutoRows: "auto", gap: 18 }}>
              <Link href={href(first)} style={{ gridRow: `span ${Math.min(Math.ceil(Math.min(rest.length, 4) / 2), 2) || 1}`, position: "relative", display: "block", minHeight: 420, borderRadius: rad, overflow: "hidden", background: first.image ? `url(${cssUrl(first.image)}) center/cover` : `${d.primary}18` }}><span aria-hidden style={{ position: "absolute", inset: 0, background: "linear-gradient(0deg, rgba(0,0,0,.72), rgba(0,0,0,0) 55%)" }} /><span style={{ position: "absolute", left: 22, right: 22, bottom: 20, color: "#fff" }}><span style={{ display: "block", fontSize: 11, fontWeight: 800, letterSpacing: ".1em", textTransform: "uppercase", opacity: .85 }}>Featured</span><span style={{ display: "block", fontFamily: d.headingFont, fontWeight: 800, fontSize: 26, margin: "4px 0" }}>{first.name}</span><span style={{ fontWeight: 800 }}>{price(first)}</span></span></Link>
              {rest.slice(0, 4).map((item) => <ItemCard key={`${item.kind}-${item.id}`} item={item} store={store} d={d} radius={rad} actionLabel={label(item)} />)}
            </div>;
          }
          return <div className="bn-grid bn-g2" style={{ gridTemplateColumns: `repeat(${[3,5,6].includes(catalogItems.length) ? Math.min(cols,3) : Math.min(cols,4)}, minmax(0,1fr))` }}>{catalogItems.map((item) => <ItemCard key={`${item.kind}-${item.id}`} item={item} store={store} d={d} radius={rad} actionLabel={label(item)} />)}</div>;
        })() : <EmptyState text="Your published products and services will appear here." />}
      </div>
    </section>
  );

  const aboutImage = s.image || (section.type === "about" ? nicheSamplePhoto(store.business.category, 1, 1000) : null);
  if ((section.type === "about" || section.type === "imageText") && !s.body && !ownText(store.business.description) && !aboutImage && !isEditMode) return null;
  if (section.type === "text" && !s.body && !isEditMode) return null;
  if (section.type === "about" || section.type === "imageText") return (
    <section id={section.id} data-bn-type={section.type} className="bn-section" style={{ padding, background: bg }}><div className="bn-wrap bn-hero" style={{ display: "grid", gridTemplateColumns: aboutImage ? "1fr 1fr" : "1fr", gap: 50, alignItems: "center" }}>
      {/* SectionIntro already prints s.body, so the paragraph below only fills in when there is no body of its own. */}
      <div><SectionIntro section={section} config={config} />{!s.body && <p style={{ color: d.muted, lineHeight: 1.8, maxWidth: 650 }}>{ownText(store.business.description) || (isEditMode ? "Write about your business in the editor. Visitors do not see this section until you do." : "")}</p>}</div>
      {aboutImage && <div style={{ minHeight: 360, borderRadius: s.radius ?? d.radius, background: `url(${cssUrl(aboutImage)}) center/cover`, boxShadow: `0 24px 60px ${d.primary}1f` }} />}
    </div></section>
  );

  if (section.type === "stats") {
    // The owner's own numbers win; otherwise live store numbers, and only the ones that are real (no "0+" or "New" to customers).
    const own = (s.items ?? []).filter((i) => i.title.trim());
    const total = catalogTotal ?? catalogItems.length; // catalogItems here is only the 8 featured ones
    const live = [
      total > 0 ? { title: `${total}+`, body: experience.mode === "commerce" ? "Published products" : experience.mode === "service" ? "Services" : "Products & services" } : null,
      completedOrders > 0 ? { title: `${completedOrders}+`, body: experience.mode === "commerce" ? "Completed orders" : "Completed bookings" } : null,
      avgRating ? { title: `${avgRating.toFixed(1)}/5`, body: "Customer rating" } : null,
    ].filter((i): i is { title: string; body: string } => i !== null);
    const stats = own.length ? own : live;
    if (!stats.length) return isEditMode ? <section id={section.id} data-bn-type={section.type} className="bn-section" style={{ padding: "28px 0", background: bg }}><div className="bn-wrap"><EmptyState text="Numbers (products, orders, rating) appear here once your store has some. Visitors do not see this box. You can also add your own numbers." /></div></section> : null;
    return <section id={section.id} data-bn-type={section.type} className="bn-section" style={{ padding: "28px 0", background: bg }}><div className="bn-wrap bn-grid" style={{ gridTemplateColumns: `repeat(${Math.min(stats.length, 4)},1fr)`, textAlign: "center" }}>{stats.map((st, i) => <Stat key={`${st.title}-${i}`} value={st.title} label={st.body || ""} d={d} />)}</div></section>;
  }

  if (section.type === "features") {
    // Only points the owner wrote. The platform no longer invents claims ("Every item is checked...") on a merchant's behalf.
    const items = (s.items ?? []).filter((i) => i.title.trim());
    if (!items.length && !isEditMode) return null;
    if (s.style === "strip") return <section id={section.id} data-bn-type={section.type} className="bn-section" style={{ padding: "28px 0", background: bg }}><div className="bn-wrap"><div className="bn-grid bn-g2" style={{ gridTemplateColumns: `repeat(${Math.min(Math.max(items.length, 1), 4)},1fr)`, gap: 12, padding: 14, background: d.surface, borderRadius: (s.radius ?? d.radius) + 4, border: `1px solid ${d.text}0f` }}>{items.map((item, i) => <div key={`${item.title}-${i}`} style={{ display: "flex", alignItems: "center", gap: 12, padding: "6px 10px" }}><span aria-hidden style={{ flex: "none", width: 38, height: 38, borderRadius: 12, display: "grid", placeItems: "center", background: `${d.accent}1f`, color: d.accent, fontWeight: 900, fontSize: 15 }}>✓</span><span><span style={{ display: "block", fontWeight: 750, fontSize: 14 }}>{item.title}</span>{item.body && <span style={{ display: "block", color: d.muted, fontSize: 12, marginTop: 2 }}>{item.body}</span>}</span></div>)}</div></div></section>;
    return <section id={section.id} data-bn-type={section.type} className="bn-section" style={{ padding, background: bg }}><div className="bn-wrap"><SectionIntro section={section} config={config} /><div className="bn-grid" style={{ gridTemplateColumns: `repeat(${Math.min(cols, 4, Math.max(items.length, 1))},1fr)` }}>{items.map((item, i) => <div key={`${item.title}-${i}`} style={{ padding: 24, background: d.surface, borderRadius: s.radius ?? d.radius, border: `1px solid ${d.text}12` }}><span aria-hidden style={{ display: "grid", placeItems: "center", width: 40, height: 40, borderRadius: 12, background: `${d.accent}1f`, color: readableAccentText(d.accent, d.surface), fontWeight: 900, fontSize: 17 }}>✓</span><h3 style={{ margin: "10px 0 7px", fontFamily: d.headingFont, fontSize: 18 }}>{item.title}</h3>{item.body && <p style={{ color: d.muted, fontSize: 13, lineHeight: 1.7, whiteSpace: "pre-line" }}>{item.body}</p>}</div>)}</div></div></section>;
  }

  // A section with nothing to show is left out on the live site (the editor still shows it so it can be configured).
  if (section.type === "categories" && !categoryLinks.length && !isEditMode) return null;
  if (section.type === "categories" && (s.style === "circles" || s.style === "pills" || s.style === "photo")) {
    const list = categoryLinks.slice(0, 10);
    const wrapIn = (body: React.ReactNode) => <section id={section.id} data-bn-type={section.type} className="bn-section" style={{ padding, background: bg }}><div className="bn-wrap"><SectionIntro section={section} config={config} />{list.length ? body : <EmptyState text="Your categories appear here once you add them in Dashboard > Categories." />}</div></section>;
    if (s.style === "circles") return wrapIn(<div style={{ display: "flex", gap: 22, flexWrap: "wrap", justifyContent: s.align === "center" ? "center" : "flex-start" }}>{list.map((c) => <a key={c.href} href={c.href} style={{ width: 112, textAlign: "center" }}><span aria-hidden style={{ display: "block", width: 112, height: 112, borderRadius: "50%", background: c.image ? `url(${cssUrl(c.image)}) center/cover` : `${d.accent}22`, border: `3px solid ${d.background}`, boxShadow: `0 0 0 1px ${d.text}14, 0 10px 24px ${d.primary}1f` }} /><span style={{ display: "block", marginTop: 10, fontWeight: 750, fontSize: 13 }}>{c.name}</span></a>)}</div>);
    if (s.style === "pills") return wrapIn(<div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>{list.map((c) => <a key={c.href} href={c.href} style={{ display: "inline-flex", alignItems: "center", gap: 10, padding: "8px 18px 8px 8px", borderRadius: 999, background: d.surface, border: `1px solid ${d.text}14`, fontWeight: 750, fontSize: 14 }}><span aria-hidden style={{ width: 34, height: 34, borderRadius: "50%", background: c.image ? `url(${cssUrl(c.image)}) center/cover` : `${d.accent}33` }} />{c.name}</a>)}</div>);
    return wrapIn(<div className="bn-grid bn-g2" style={{ gridTemplateColumns: `repeat(${Math.min(Math.max(list.length, 2), 4)},minmax(0,1fr))`, gap: 16 }}>{list.slice(0, 8).map((c) => <a key={c.href} href={c.href} style={{ position: "relative", display: "block", aspectRatio: "3/4", overflow: "hidden", borderRadius: s.radius ?? d.radius, background: c.image ? `url(${cssUrl(c.image)}) center/cover` : `linear-gradient(160deg, ${d.accent}66, ${d.primary}55)` }}><span aria-hidden style={{ position: "absolute", inset: 0, background: "linear-gradient(0deg, rgba(0,0,0,.66), rgba(0,0,0,0) 55%)" }} /><span style={{ position: "absolute", left: 16, right: 16, bottom: 14, color: "#fff", fontWeight: 800, fontFamily: d.headingFont, fontSize: 18 }}>{c.name}<span style={{ display: "block", fontSize: 12, fontWeight: 650, opacity: .85, marginTop: 3 }}>Explore →</span></span></a>)}</div>);
  }
  if (section.type === "categories" && (s.style === "tiles" || !s.style)) {
    const tints = [`${d.accent}1c`, `${d.primary}14`, `${d.accent}33`, `${d.primary}0d`];
    return <section id={section.id} data-bn-type={section.type} className="bn-section" style={{ padding, background: bg }}><div className="bn-wrap"><SectionIntro section={section} config={config} />{categoryLinks.length ? <div className="bn-grid bn-g2" style={{ gridTemplateColumns: `repeat(${Math.min(Math.max(categoryLinks.length, 2), cols === 3 ? 4 : cols)},minmax(0,1fr))`, gap: 14 }}>{categoryLinks.slice(0, 8).map((c, i) => <a key={c.href} href={c.href} style={{ position: "relative", display: "flex", flexDirection: "column", justifyContent: "space-between", minHeight: 170, padding: 18, overflow: "hidden", borderRadius: s.radius ?? d.radius, background: tints[i % tints.length], border: `1px solid ${d.text}0d` }}><span style={{ position: "relative", zIndex: 1, fontWeight: 800, fontSize: 15, fontFamily: d.headingFont }}>{c.name}<span style={{ display: "block", color: readableAccentText(d.accent, d.surface), fontSize: 12, fontWeight: 700, marginTop: 4 }}>Shop now →</span></span>{c.image ? <span aria-hidden style={{ position: "absolute", right: -14, bottom: -14, width: "64%", aspectRatio: "1/1", borderRadius: "50%", background: `url(${cssUrl(c.image)}) center/cover`, boxShadow: `0 10px 30px ${d.primary}33` }} /> : <span aria-hidden style={{ position: "absolute", right: 14, bottom: 14, width: 56, height: 56, borderRadius: "50%", display: "grid", placeItems: "center", background: `${d.accent}33`, color: readableAccentText(d.accent, d.surface), fontFamily: d.headingFont, fontWeight: 800, fontSize: 22 }}>{c.name.slice(0, 1).toUpperCase()}</span>}</a>)}</div> : <EmptyState text="Your categories appear here once you add them in Dashboard > Categories." />}</div></section>;
  }
  if (section.type === "promo") {
    if (!s.heading && !isEditMode) return null;
    const fg = s.textColor || "#fff";
    const base = s.background || `linear-gradient(110deg, ${d.primary}, ${d.accent})`;
    const items = (s.items ?? []).filter((i) => i.title.trim());
    return <section id={section.id} data-bn-type={section.type} className="bn-section" style={{ padding: "36px 0", background: d.background }}><div className="bn-wrap"><div className="bn-hero" style={{ position: "relative", overflow: "hidden", display: "grid", gridTemplateColumns: s.image ? "1.25fr .75fr" : "1fr", alignItems: "center", gap: 28, padding: "40px 44px", borderRadius: (s.radius ?? d.radius) + 6, background: base, color: fg }}>
      <div style={{ textAlign: s.align === "center" ? "center" : "left" }}>
        {s.eyebrow && <span style={{ display: "inline-block", padding: "5px 12px", borderRadius: 999, background: "rgba(255,255,255,.18)", fontSize: 12, fontWeight: 800, marginBottom: 14 }}>{s.eyebrow}</span>}
        <h2 style={{ fontFamily: d.headingFont, fontSize: "clamp(26px,3.6vw,44px)", lineHeight: 1.08, letterSpacing: "-.03em", margin: 0 }}>{s.heading}</h2>
        {s.body && <p style={{ opacity: .85, lineHeight: 1.7, maxWidth: 520, margin: "12px 0 0" }}>{s.body}</p>}
        {items.length > 0 && <ul style={{ listStyle: "none", padding: 0, margin: "16px 0 0", display: "flex", gap: 10, flexWrap: "wrap" }}>{items.map((i, n) => <li key={n} style={{ padding: "6px 12px", borderRadius: 999, background: "rgba(255,255,255,.16)", fontSize: 12, fontWeight: 750 }}>{i.title}</li>)}</ul>}
        {s.showButton !== false && s.ctaLabel && <a href={safeHref(s.ctaHref, "#catalog")} style={{ display: "inline-block", marginTop: 22, padding: "13px 24px", borderRadius: d.buttonStyle === "pill" ? 999 : (s.radius ?? d.radius), background: "#fff", color: d.primary, fontWeight: 800, fontSize: 14 }}>{s.ctaLabel}</a>}
      </div>
      {s.image && <div aria-hidden style={{ minHeight: 190, borderRadius: s.radius ?? d.radius, background: `url(${cssUrl(s.image)}) center/cover` }} />}
    </div></div></section>;
  }
  if (section.type === "categories") return <section id={section.id} data-bn-type={section.type} className="bn-section" style={{ padding, background: bg }}><div className="bn-wrap"><SectionIntro section={section} config={config} /><div className="bn-grid" style={{ gridTemplateColumns: `repeat(${Math.min(cols,4)},1fr)` }}>{categoryLinks.map((c) => <a key={c.href} href={c.href} style={{ padding: 22, borderRadius: s.radius ?? d.radius, background: d.surface, border: `1px solid ${d.text}12`, fontWeight: 750 }}>{c.name}</a>)}</div></div></section>;

  if (section.type === "testimonials") {
    // Real reviews first, then testimonials the owner typed in. Capped so the grid stays tidy.
    const cards: { key: string; rating: number | null; text: string; name: string }[] = [
      ...reviews.map((r) => ({ key: r.id, rating: r.rating, text: r.comment ?? "", name: r.author?.name || "Customer" })),
      ...(s.items ?? []).filter((i) => i.title.trim()).map((i, n) => ({ key: `own-${n}`, rating: null, text: i.body ?? "", name: i.title })),
    ].slice(0, 6);
    if (!cards.length && !isEditMode) return null; // never show customers an empty "reviews will appear here" box
    return <section id={section.id} data-bn-type={section.type} className="bn-section" style={{ padding, background: bg }}><div className="bn-wrap"><SectionIntro section={section} config={config} /><div className="bn-grid" style={{ gridTemplateColumns: `repeat(${Math.min(cols, 3, Math.max(cards.length, 1))},1fr)` }}>{cards.length ? cards.map((c) => <div key={c.key} style={{ display: "flex", flexDirection: "column", background: d.surface, border: `1px solid ${d.text}12`, borderRadius: s.radius ?? d.radius, padding: 24 }}>{c.rating !== null && <div style={{ color: d.accent }}>{starFill(c.rating)}{starEmpty(c.rating)}</div>}<p style={{ lineHeight: 1.7, color: d.muted, flex: 1 }}>{c.text}</p><div style={{ display: "flex", alignItems: "center", gap: 10, marginTop: 6 }}><span aria-hidden style={{ width: 34, height: 34, borderRadius: "50%", display: "grid", placeItems: "center", background: `${d.accent}22`, color: readableAccentText(d.accent, d.surface), fontWeight: 800, fontSize: 13 }}>{c.name.slice(0, 1).toUpperCase()}</span><strong style={{ fontSize: 13 }}>{c.name}</strong></div></div>) : <EmptyState text="Customer reviews will appear here when you receive them. Visitors do not see this box. You can also add your own testimonials." />}</div></div></section>;
  }

  if (section.type === "newsletter") return <section id={section.id} data-bn-type={section.type} className="bn-section" style={{ padding, background: s.background || d.primary, color: s.textColor || "#fff" }}><div className="bn-wrap" style={{ textAlign: "center" }}><SectionIntro section={section} config={config} inverse /><p style={{ opacity: .75, maxWidth: 560, margin: "0 auto 22px", lineHeight: 1.7 }}>{s.body || "Get occasional updates, new arrivals and offers."}</p><BuilderNewsletterForm storeSlug={store.slug} accent={d.accent} /></div></section>;

  if (section.type === "contact") {
    const wa = whatsappLink(store.whatsappNumber);
    const tile = { padding: 24, background: d.surface, borderRadius: s.radius ?? d.radius } as const;
    const hasAny = !!(store.contactEmail || store.contactPhone || wa);
    if (!hasAny && !isEditMode) return null; // an intro with nothing under it helps nobody
    return <section id={section.id} data-bn-type={section.type} className="bn-section" style={{ padding, background: bg }}><div className="bn-wrap"><SectionIntro section={section} config={config} /><div className="bn-grid" style={{ gridTemplateColumns: "repeat(2,1fr)" }}>{wa && <a href={wa} target="_blank" rel="noopener noreferrer" style={tile}><small style={{ color: d.muted }}>WhatsApp</small><div style={{ fontWeight: 750, marginTop: 5 }}>Chat with us</div></a>}{store.contactPhone && <a href={`tel:${store.contactPhone}`} style={tile}><small style={{ color: d.muted }}>Phone</small><div style={{ fontWeight: 750, marginTop: 5 }}>{store.contactPhone}</div></a>}{store.contactEmail && <a href={`mailto:${store.contactEmail}`} style={tile}><small style={{ color: d.muted }}>Email</small><div style={{ fontWeight: 750, marginTop: 5 }}>{store.contactEmail}</div></a>}{!hasAny && <EmptyState text="Add a WhatsApp number, phone or email in Settings to show contact options. Visitors do not see this box." />}</div></div></section>;
  }

  if (section.type === "gallery") {
    // The owner's own uploads win; with none, fall back to catalogue photos so the section is never blank.
    const own = (s.images ?? []).filter(Boolean);
    const tiles: { key: string; image: string | null }[] = own.length ? own.slice(0, 24).map((image, i) => ({ key: `img-${i}`, image })) : catalogItems.slice(0, 8).map((item) => ({ key: `${item.kind}-${item.id}`, image: item.image }));
    if (!tiles.length && !isEditMode) return null;
    return <section id={section.id} data-bn-type={section.type} className="bn-section" style={{ padding, background: bg }}><div className="bn-wrap"><SectionIntro section={section} config={config} /><div className="bn-grid bn-g2" style={{ gridTemplateColumns: `repeat(${Math.min(cols,4)},1fr)` }}>{tiles.map((t) => <div key={t.key} style={{ aspectRatio: "1/1", borderRadius: s.radius ?? d.radius, background: t.image ? `url(${cssUrl(t.image)}) center/cover` : d.surface }} />)}</div></div></section>;
  }

  if (section.type === "map") {
    const query = mapQuery(s.address, store.business);
    if (!query && !isEditMode) return null;
    return <section id={section.id} data-bn-type={section.type} className="bn-section" style={{ padding, background: bg }}><div className="bn-wrap"><SectionIntro section={section} config={config} />{query ? <>
      <iframe title={`Map of ${query}`} src={mapEmbedUrl(query)} loading="lazy" referrerPolicy="no-referrer-when-downgrade" style={{ width: "100%", height: 340, border: 0, borderRadius: s.radius ?? d.radius, background: d.surface, display: "block" }} />
      <p style={{ marginTop: 14, color: d.muted, fontSize: 14 }}>{query} · <a href={mapDirectionsUrl(query)} target="_blank" rel="noopener noreferrer" style={{ color: d.accent, fontWeight: 750 }}>Get directions</a></p>
    </> : <div style={{ minHeight: 280, borderRadius: s.radius ?? d.radius, background: `linear-gradient(135deg, ${d.primary}16, ${d.accent}18)`, display: "grid", placeItems: "center", color: d.muted, padding: 24, textAlign: "center" }}>Add an address to this section, or set your city and state in Store Settings, to show your map here.</div>}</div></section>;
  }

  if (section.type === "faq") {
    // The owner's own questions, else the store's own FAQ (e.g. written by the AI store builder). Nothing is invented.
    const items = (s.items ?? []).filter((i) => i.title.trim()).length ? (s.items ?? []) : fallbackFaq?.length ? fallbackFaq : [];
    if (!items.length && !isEditMode) return null;
    return <section id={section.id} data-bn-type={section.type} className="bn-section" style={{ padding, background: bg }}><div className="bn-wrap" style={{ maxWidth: 850 }}><SectionIntro section={section} config={config} />{items.map((item, i) => <details key={`${item.title}-${i}`} style={{ borderTop: `1px solid ${d.text}14`, padding: "18px 0" }}><summary style={{ cursor: "pointer", fontWeight: 750 }}>{item.title}</summary>{item.body && <p style={{ color: d.muted, lineHeight: 1.7, whiteSpace: "pre-line" }}>{item.body}</p>}</details>)}</div></section>;
  }

  if (section.type === "text") return <section id={section.id} data-bn-type={section.type} className="bn-section" style={{ padding, background: bg }}><div className="bn-wrap" style={{ maxWidth: 1160 }}><SectionIntro section={section} config={config} /><p style={{ color: d.muted, lineHeight: 1.8, whiteSpace: "pre-wrap" }}>{s.body}</p></div></section>;

  return null;
}

function SectionIntro({ section, config, inverse = false }: { section: BuilderSection; config: BuilderConfig; inverse?: boolean }) {
  const d = config.design, s = section.settings;
  return <div style={{ marginBottom: 30, textAlign: s.align || "left" }}>
    {s.eyebrow && <div style={{ color: inverse ? d.accent : readableAccentText(d.accent, s.background || d.background), fontSize: 11, fontWeight: 800, letterSpacing: ".12em", textTransform: "uppercase", marginBottom: 8 }}>{s.eyebrow}</div>}
    <h2 style={{ fontFamily: d.headingFont, fontSize: "clamp(28px,4vw,46px)", lineHeight: 1.08, letterSpacing: "-.035em", margin: 0, color: inverse ? "#fff" : d.text }}>{s.heading || label(section.type)}</h2>
    {s.body && <p style={{ color: inverse ? "rgba(255,255,255,.72)" : d.muted, lineHeight: 1.7, maxWidth: 650, marginTop: 12 }}>{s.body}</p>}
  </div>;
}

function label(type: string) { return ({ hero: "Welcome", catalog: "Shop", about: "About us", stats: "At a glance", features: "Why choose us", categories: "Categories", testimonials: "Testimonials", newsletter: "Newsletter", contact: "Contact", gallery: "Gallery", map: "Location", faq: "FAQ", text: "More about us", imageText: "Our story", promo: "Special offer" } as Record<string,string>)[type] || "Section"; }
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
  // The owner's own top-level categories come first (up to three), so the menu says what this business sells.
  // With none yet, a store that sells products gets a single "Categories" link as before.
  const ownCategories = useStoreCategories().filter((c) => !c.parentId).slice(0, 3);
  const defaultMenu: FallbackLink[] = [
    ["Home", "/"],
    [experience.mode === "service" ? "Services" : "Shop", "/catalog"],
    ...(ownCategories.length
      ? ownCategories.map((c): FallbackLink => [c.name, `/category/${c.slug || c.id}`])
      : experience.mode === "service" ? [] : ([["Categories", "/categories"]] as FallbackLink[])),
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
  // Customer sign-in / account sits beside the cart on EVERY store, services included (service stores have no cart).
  const cart = (
    <span style={{ display: "inline-flex", alignItems: "center", gap: 14 }}>
      <AccountLink storeSlug={store.slug} ink={style === "stripe" ? "#ffffff" : d.text} />
      {experience.mode !== "service" ? <CartLink storeSlug={store.slug} accent={d.accent} /> : null}
    </span>
  );
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
          <span style={{ opacity: .9 }}>{store.business?.description ? (() => { const t = String(store.business.description); if (t.length <= 70) return t; const cut = t.slice(0, 70); return cut.slice(0, Math.max(cut.lastIndexOf(" "), 40)).replace(/[.,;:\s]+$/, "") + "…"; })() : `Welcome to ${store.name}`}</span>
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
  const ownerFooter = useFooterMenu(); // the footer menu the owner built wins over the template's own links
  const navLinks = ownerFooter ?? storeLinks ?? anchors.map((s) => ({ label: s.settings.heading || label(s.type), href: `#${s.id}` }));
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
  const price = `${item.currency} ${formatNumber(item.price)}`;
  const img = (ratio: string, r: number | string = 0): React.CSSProperties => ({ aspectRatio: ratio, borderRadius: r, background: item.image ? `url(${cssUrl(item.image)}) center/cover` : `${d.primary}12` });
  if (style === "overlay") return (
    <Link href={href} style={{ position: "relative", display: "block", borderRadius: radius, overflow: "hidden" }}>
      <div style={img("4/5")} />
      <div style={{ position: "absolute", inset: "auto 0 0 0", padding: "44px 14px 14px", color: "#fff", background: "linear-gradient(0deg,rgba(0,0,0,.86),rgba(0,0,0,.55) 55%,rgba(0,0,0,0))" }}>
        <div style={{ fontWeight: 750, fontFamily: d.headingFont, overflowWrap: "anywhere", display: "-webkit-box", WebkitLineClamp: 2, WebkitBoxOrient: "vertical", overflow: "hidden" }}>{item.name}</div>
        <div style={{ fontWeight: 800, marginTop: 4, color: "#fff" }}>{price}</div>
      </div>
    </Link>
  );
  if (style === "soft") return (
    <Link href={href} style={{ position: "relative", display: "flex", flexDirection: "column", borderRadius: radius + 4, background: d.surface, padding: 14, border: `1px solid ${d.text}0d`, boxShadow: `0 1px 0 ${d.text}08` }}>
      <div style={{ ...img("1/1", Math.max(radius - 2, 6)), backgroundColor: `${d.primary}0d` }} />
      <div style={{ padding: "12px 2px 2px", display: "flex", alignItems: "flex-end", justifyContent: "space-between", gap: 10 }}>
        <div style={{ minWidth: 0 }}>
          {item.categoryName && <div style={{ fontSize: 10, letterSpacing: ".08em", textTransform: "uppercase", color: d.muted, fontWeight: 700, marginBottom: 3, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{item.categoryName}</div>}
          <div style={{ fontWeight: 750, lineHeight: 1.25 }}>{item.name}</div>
          <div style={{ marginTop: 6, fontWeight: 800, color: readableAccentText(d.accent, d.surface) }}>{price}</div>
        </div>
        <span aria-hidden style={{ flex: "none", width: 36, height: 36, borderRadius: 999, display: "grid", placeItems: "center", background: `${d.accent}22`, color: readableAccentText(d.accent, d.surface), fontSize: 15, fontWeight: 900 }}>{item.kind === "service" ? "→" : "+"}</span>
      </div>
    </Link>
  );
  if (style === "lifted") return (
    <div style={{ display: "flex", flexDirection: "column", borderRadius: radius, background: d.surface, boxShadow: `0 1px 2px ${d.text}10, 0 12px 28px ${d.text}0f`, overflow: "hidden" }}>
      <Link href={href} style={{ display: "block", position: "relative" }}>
        <div style={{ ...img("1/1"), backgroundColor: `${d.primary}0d` }} />
        {item.categoryName && <span style={{ position: "absolute", top: 10, left: 10, padding: "4px 10px", borderRadius: 999, background: d.background, fontSize: 11, fontWeight: 800 }}>{item.categoryName}</span>}
      </Link>
      <div style={{ padding: "14px 16px 16px", display: "flex", flexDirection: "column", gap: 4, flex: 1 }}>
        <Link href={href} style={{ fontWeight: 750, lineHeight: 1.25 }}>{item.name}</Link>
        <div style={{ fontWeight: 850, fontSize: 17, color: readableAccentText(d.accent, d.surface) }}>{price}</div>
        <Link href={href} style={{ marginTop: "auto", paddingTop: 10 }}><span style={{ display: "block", textAlign: "center", padding: "10px 12px", borderRadius: Math.min(radius, 12), border: `1.5px solid ${d.accent}`, color: readableAccentText(d.accent, d.surface), fontWeight: 800, fontSize: 13 }}>{actionLabel}</span></Link>
      </div>
    </div>
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
      <div style={{ color: readableAccentText(d.accent, d.background), fontWeight: 800, marginTop: 4 }}>{price}</div>
    </Link>
  );
  return (
    <Link href={href} className="bn-itemcard" style={{ display: "block", border: `1px solid ${d.text}12`, borderRadius: radius, overflow: "hidden", background: d.surface }}>
      <div style={{ position: "relative", overflow: "hidden" }}>
        <div className="bn-itemimg" style={img("1/1")} />
        <span aria-hidden style={{ position: "absolute", right: 12, bottom: 12, width: 38, height: 38, borderRadius: "50%", display: "grid", placeItems: "center", background: d.background, color: d.text, fontWeight: 900, fontSize: 18, boxShadow: "0 6px 16px rgba(0,0,0,.18)" }}>{item.kind === "service" ? "→" : "+"}</span>
      </div>
      <div style={{ padding: 16 }}>
        <div style={{ fontWeight: 750, marginBottom: 7 }}>{item.name}</div>
        <div style={{ color: readableAccentText(d.accent, d.surface), fontWeight: 800 }}>{price}</div>
        <div style={{ marginTop: 10, fontSize: 11, color: d.muted, fontWeight: 700 }}>{actionLabel} →</div>
      </div>
    </Link>
  );
}
