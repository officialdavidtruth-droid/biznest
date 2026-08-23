import type React from "react";
import Link from "next/link";
import { CartLink } from "@/components/storefront/cart-link";
import { BuilderNewsletterForm } from "@/components/storefront/builder-newsletter-form";
import type { BuilderConfig, BuilderSection } from "@/lib/builder-config";
import { getBusinessExperience } from "@/lib/business-experience";

type CatalogItem = {
  id: string; kind: "product" | "service"; name: string; price: number; currency: string;
  image: string | null; categoryName: string | null;
};

type Review = { id: string; rating: number; comment: string | null; author: { name: string | null } | null };

type BuilderStore = {
  name: string; slug: string; logoUrl: string | null; contactEmail: string | null; contactPhone: string | null;
  business: { description: string | null; category?: string | null };
};

export function BuilderStorefront({
  store, config, catalogItems, reviews, avgRating, completedOrders,
}: {
  store: BuilderStore;
  config: BuilderConfig;
  catalogItems: CatalogItem[];
  reviews: Review[];
  avgRating: number | null;
  completedOrders: number;
}) {
  const d = config.design;
  const experience = getBusinessExperience(store.business.category);
  const width = d.containerWidth === "compact" ? 960 : d.containerWidth === "wide" ? 1320 : 1160;
  const visible = config.sections.filter((s) => s.visible);
  const featured = catalogItems.slice(0, 8);
  const categories = Array.from(new Set(catalogItems.map((i) => i.categoryName).filter(Boolean))) as string[];

  return (
    <main style={{ background: d.background, color: d.text, fontFamily: d.font, minHeight: "100vh" }}>
      <style>{`a{text-decoration:none;color:inherit}.bn-wrap{width:min(${width}px,calc(100% - 32px));margin:0 auto}.bn-grid{display:grid;gap:20px}@media(max-width:720px){.bn-grid{grid-template-columns:1fr!important}.bn-hero{grid-template-columns:1fr!important}.bn-section{padding-top:56px!important;padding-bottom:56px!important}.bn-nav-links{display:none!important}}`}</style>
      <nav style={{ borderBottom: `1px solid ${d.text}14`, background: d.background, position: "sticky", top: 0, zIndex: 20, backdropFilter: "blur(14px)" }}>
        <div className="bn-wrap" style={{ height: 70, display: "flex", alignItems: "center", justifyContent: "space-between", gap: 18 }}>
          <Link href={`/${store.slug}`} style={{ display: "flex", alignItems: "center", gap: 10, fontWeight: 800 }}>
            {store.logoUrl ? <img src={store.logoUrl} alt="" style={{ width: 36, height: 36, borderRadius: Math.min(d.radius, 12), objectFit: "cover" }} /> : <span style={{ width: 36, height: 36, borderRadius: Math.min(d.radius, 12), background: d.primary, display: "grid", placeItems: "center", color: "#fff" }}>{store.name.slice(0,1).toUpperCase()}</span>}
            {store.name}
          </Link>
          <div className="bn-nav-links" style={{ display: "flex", gap: 22, fontSize: 13, color: d.muted }}>
            {visible.filter((s) => ["catalog", "about", "contact"].includes(s.type)).map((s) => <a key={s.id} href={`#${s.id}`}>{s.settings.heading || label(s.type)}</a>)}
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: 10 }}><span style={{ fontSize: 11, color: d.muted, display: "none" }} className="bn-mode-label">{experience.mode === "commerce" ? "Shopping" : "Booking & enquiries"}</span><CartLink storeSlug={store.slug} accent={d.accent} /></div>
        </div>
      </nav>

      {visible.map((section) => <BuilderSectionView key={section.id} section={section} store={store} config={config} catalogItems={featured} categories={categories} experience={experience} reviews={reviews} avgRating={avgRating} completedOrders={completedOrders} />)}

      <footer style={{ marginTop: 60, padding: "48px 0", background: d.primary, color: "#fff" }}>
        <div className="bn-wrap" style={{ display: "flex", justifyContent: "space-between", gap: 24, flexWrap: "wrap" }}>
          <div><strong style={{ fontSize: 20 }}>{store.name}</strong><p style={{ opacity: .72, maxWidth: 460, lineHeight: 1.7, fontSize: 13 }}>{store.business.description || "Built with BizNest."}</p></div>
          <div style={{ opacity: .75, fontSize: 13 }}>{store.contactEmail || store.contactPhone || "Online business"}</div>
        </div>
      </footer>
    </main>
  );
}

function BuilderSectionView({ section, store, config, catalogItems, categories, reviews, avgRating, completedOrders }: {
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

  if (section.type === "hero") return (
    <section id={section.id} className="bn-section" style={{ padding, background: bg }}>
      <div className="bn-wrap bn-hero" style={{ display: "grid", gridTemplateColumns: s.image ? "1.05fr .95fr" : "1fr", alignItems: "center", gap: 50 }}>
        <div style={{ textAlign: align }}>
          {s.eyebrow && <div style={{ color: d.accent, fontSize: 12, fontWeight: 800, letterSpacing: ".12em", textTransform: "uppercase", marginBottom: 12 }}>{s.eyebrow}</div>}
          <h1 style={{ fontFamily: d.headingFont, fontSize: "clamp(40px,6vw,72px)", lineHeight: 1.03, margin: 0, letterSpacing: "-.04em" }}>{heading}</h1>
          {s.body && <p style={{ color: d.muted, maxWidth: 650, lineHeight: 1.75, fontSize: 16, margin: "22px 0 28px", marginLeft: align === "center" ? "auto" : 0, marginRight: align === "center" ? "auto" : 0 }}>{s.body}</p>}
          {button}
        </div>
        {s.image && <div style={{ minHeight: 440, borderRadius: s.radius ?? d.radius, background: `url(${s.image}) center/cover`, boxShadow: `0 30px 80px ${d.primary}22` }} />}
      </div>
    </section>
  );

  if (section.type === "catalog") return (
    <section id={section.id} className="bn-section" style={{ padding, background: bg }}>
      <div className="bn-wrap"><SectionIntro section={section} config={config} />
        {catalogItems.length ? <div className="bn-grid" style={{ gridTemplateColumns: `repeat(${Math.min(cols,4)}, minmax(0,1fr))` }}>{catalogItems.map((item) => <Link key={`${item.kind}-${item.id}`} href={`/${store.slug}/${item.kind}/${item.id}`} style={{ border: `1px solid ${d.text}12`, borderRadius: s.radius ?? d.radius, overflow: "hidden", background: d.surface }}><div style={{ aspectRatio: "1/1", background: item.image ? `url(${item.image}) center/cover` : `${d.primary}12` }} /><div style={{ padding: 16 }}><div style={{ fontWeight: 750, marginBottom: 7 }}>{item.name}</div><div style={{ color: d.accent, fontWeight: 800 }}>{item.currency} {item.price.toLocaleString()}</div><div style={{ marginTop: 10, fontSize: 11, color: d.muted, fontWeight: 700 }}>{item.kind === "service" ? experience.primaryAction : "View product"} →</div></div></Link>)}</div> : <EmptyState text="Your published products and services will appear here." />}
      </div>
    </section>
  );

  if (section.type === "about" || section.type === "imageText") return (
    <section id={section.id} className="bn-section" style={{ padding, background: bg }}><div className="bn-wrap bn-hero" style={{ display: "grid", gridTemplateColumns: s.image ? "1fr 1fr" : "1fr", gap: 50, alignItems: "center" }}>
      <div><SectionIntro section={section} config={config} /><p style={{ color: d.muted, lineHeight: 1.8, maxWidth: 650 }}>{s.body || store.business.description}</p></div>
      {s.image && <div style={{ minHeight: 360, borderRadius: s.radius ?? d.radius, background: `url(${s.image}) center/cover` }} />}
    </div></section>
  );

  if (section.type === "stats") return <section id={section.id} className="bn-section" style={{ padding: "28px 0", background: bg }}><div className="bn-wrap bn-grid" style={{ gridTemplateColumns: "repeat(3,1fr)", textAlign: "center" }}><Stat value={`${catalogItems.length}+`} label="Published items" d={d} /><Stat value={`${completedOrders}+`} label="Completed orders" d={d} /><Stat value={avgRating ? `${avgRating.toFixed(1)}/5` : "New"} label="Customer rating" d={d} /></div></section>;

  if (section.type === "features") return <section id={section.id} className="bn-section" style={{ padding, background: bg }}><div className="bn-wrap"><SectionIntro section={section} config={config} /><div className="bn-grid" style={{ gridTemplateColumns: `repeat(${Math.min(cols,4)},1fr)` }}>{["Quality you can trust", "Simple online ordering", "Responsive customer support", "Built for your business"].map((item, i) => <div key={item} style={{ padding: 24, background: d.surface, borderRadius: s.radius ?? d.radius, border: `1px solid ${d.text}12` }}><div style={{ color: d.accent, fontWeight: 900, fontSize: 12 }}>0{i + 1}</div><h3 style={{ margin: "10px 0 7px", fontFamily: d.headingFont, fontSize: 18 }}>{item}</h3><p style={{ color: d.muted, fontSize: 13, lineHeight: 1.7 }}>Customize this benefit in your visual builder to tell customers why your business is different.</p></div>)}</div></div></section>;

  if (section.type === "categories") return <section id={section.id} className="bn-section" style={{ padding, background: bg }}><div className="bn-wrap"><SectionIntro section={section} config={config} /><div className="bn-grid" style={{ gridTemplateColumns: `repeat(${Math.min(cols,4)},1fr)` }}>{categories.map((c) => <a key={c} href={`/${store.slug}/search?q=${encodeURIComponent(c)}`} style={{ padding: 22, borderRadius: s.radius ?? d.radius, background: d.surface, border: `1px solid ${d.text}12`, fontWeight: 750 }}>{c}</a>)}</div></div></section>;

  if (section.type === "testimonials") return <section id={section.id} className="bn-section" style={{ padding, background: bg }}><div className="bn-wrap"><SectionIntro section={section} config={config} /><div className="bn-grid" style={{ gridTemplateColumns: `repeat(${Math.min(cols,3)},1fr)` }}>{reviews.length ? reviews.map((r) => <div key={r.id} style={{ background: d.surface, border: `1px solid ${d.text}12`, borderRadius: s.radius ?? d.radius, padding: 22 }}><div style={{ color: d.accent }}>{"★".repeat(r.rating)}{"☆".repeat(5-r.rating)}</div><p style={{ lineHeight: 1.7, color: d.muted }}>{r.comment}</p><strong style={{ fontSize: 13 }}>{r.author?.name || "Customer"}</strong></div>) : <EmptyState text="Customer reviews will appear here when you receive them." />}</div></div></section>;

  if (section.type === "newsletter") return <section id={section.id} className="bn-section" style={{ padding, background: s.background || d.primary, color: s.textColor || "#fff" }}><div className="bn-wrap" style={{ textAlign: "center" }}><SectionIntro section={section} config={config} inverse /><p style={{ opacity: .75, maxWidth: 560, margin: "0 auto 22px", lineHeight: 1.7 }}>{s.body || "Get occasional updates, new arrivals and offers."}</p><BuilderNewsletterForm storeSlug={store.slug} accent={d.accent} /></div></section>;

  if (section.type === "contact") return <section id={section.id} className="bn-section" style={{ padding, background: bg }}><div className="bn-wrap"><SectionIntro section={section} config={config} /><div className="bn-grid" style={{ gridTemplateColumns: "repeat(2,1fr)" }}>{store.contactEmail && <a href={`mailto:${store.contactEmail}`} style={{ padding: 24, background: d.surface, borderRadius: s.radius ?? d.radius }}><small style={{ color: d.muted }}>Email</small><div style={{ fontWeight: 750, marginTop: 5 }}>{store.contactEmail}</div></a>}{store.contactPhone && <a href={`tel:${store.contactPhone}`} style={{ padding: 24, background: d.surface, borderRadius: s.radius ?? d.radius }}><small style={{ color: d.muted }}>Phone</small><div style={{ fontWeight: 750, marginTop: 5 }}>{store.contactPhone}</div></a>}</div></div></section>;

  if (section.type === "gallery") return <section id={section.id} className="bn-section" style={{ padding, background: bg }}><div className="bn-wrap"><SectionIntro section={section} config={config} /><div className="bn-grid" style={{ gridTemplateColumns: `repeat(${Math.min(cols,4)},1fr)` }}>{catalogItems.slice(0,8).map((item) => <div key={item.id} style={{ aspectRatio: "1/1", borderRadius: s.radius ?? d.radius, background: item.image ? `url(${item.image}) center/cover` : d.surface }} />)}</div></div></section>;

  if (section.type === "map") return <section id={section.id} className="bn-section" style={{ padding, background: bg }}><div className="bn-wrap"><SectionIntro section={section} config={config} /><div style={{ minHeight: 280, borderRadius: s.radius ?? d.radius, background: `linear-gradient(135deg, ${d.primary}16, ${d.accent}18)`, display: "grid", placeItems: "center", color: d.muted }}>Add your location in Store Settings to show your map here.</div></div></section>;

  if (section.type === "faq" || section.type === "text") return <section id={section.id} className="bn-section" style={{ padding, background: bg }}><div className="bn-wrap" style={{ maxWidth: section.type === "faq" ? 850 : 1160 }}>{section.type === "faq" ? <><SectionIntro section={section} config={config} /><details style={{ borderTop: `1px solid ${d.text}14`, padding: "18px 0" }}><summary style={{ cursor: "pointer", fontWeight: 750 }}>How do I place an order?</summary><p style={{ color: d.muted, lineHeight: 1.7 }}>Browse the store, add an item to your cart and complete checkout.</p></details><details style={{ borderTop: `1px solid ${d.text}14`, padding: "18px 0" }}><summary style={{ cursor: "pointer", fontWeight: 750 }}>How can I contact this business?</summary><p style={{ color: d.muted, lineHeight: 1.7 }}>{store.contactEmail || store.contactPhone || "Use the contact section on this store."}</p></details></> : <><SectionIntro section={section} config={config} /><p style={{ color: d.muted, lineHeight: 1.8, whiteSpace: "pre-wrap" }}>{s.body}</p></>}</div></section>;

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
