"use client";

import { RADIUS_PX, type PageSkin } from "@/lib/storefront/page-skin";
import { readableOn } from "@/lib/storefront/readable-design";
import { starFill, starEmpty } from "@/lib/utils/stars";
import { cssUrl, fontStack } from "@/lib/builder-safe";
import Link from "next/link";
import type { ReactNode } from "react";
import { Mail, MapPin, Phone } from "lucide-react";
import type { BuilderConfig } from "@/lib/builder-config";
import { getBusinessExperience } from "@/lib/business-experience";
import { BuilderFooter, BuilderHeader } from "@/components/storefront/builder-renderer";
import { ContactEnquiryForm } from "@/components/storefront/contact-enquiry-form";
import { parseBlogPosts, parseGalleryBody } from "@/lib/storefront/owner-page-format";
import { PageBlocks } from "@/components/storefront/page-blocks";
import type { PageBlock } from "@/lib/storefront/page-blocks";
import type { BlockCatalog } from "@/lib/storefront/page-block-catalog";

type Design = BuilderConfig["design"];
export type SubpageStore = {
  name: string; slug: string; logoUrl: string | null; contactEmail: string | null; contactPhone: string | null;
  business: { description: string | null; category?: string | null; businessSubcategory?: string | null; sellsProducts?: boolean; offersServices?: boolean };
};
export type SubpageCategory = { id: string; name: string; count: number; children: { id: string; name: string; count: number }[] };
export type SubpageData = {
  storyImage: string | null; location: string; itemCount: number; completedOrders: number; avgRating: number | null;
  reviews: { id: string; rating: number; comment: string; author: string }[]; categories: SubpageCategory[];
};
export type SubpageKind = "about" | "contact" | "categories" | "gallery" | "blog";
/** The owner's own text for this page (Customize > Pages). When present it replaces the page's default copy. */
export type OwnerContent = { title: string; body: string; blocks?: PageBlock[]; catalog?: BlockCatalog };

const COPY: Record<SubpageKind, { title: string; subtitle: string }> = {
  about: { title: "About us", subtitle: "Who we are and what we stand for." },
  contact: { title: "Contact us", subtitle: "Questions, orders or special requests? We'd love to hear from you." },
  categories: { title: "Shop by category", subtitle: "Find exactly what you need across the whole collection." },
  gallery: { title: "Gallery", subtitle: "A closer look." },
  blog: { title: "Blog", subtitle: "News and updates." },
};

/**
 * Inner pages (About / Contact / Categories) for stores on the shared Builder renderer.
 * Uses the same BuilderHeader, BuilderFooter and design tokens as the homepage and the
 * catalogue, so every page looks like one site. (The generic "universal" pages have their
 * own header and palette, which is what made /about look like a different template.)
 */
export function BuilderSubpage({ kind, store, design: designIn, data, owner, skin }: { skin?: PageSkin; kind: SubpageKind; store: SubpageStore; design: Design; data: SubpageData; owner?: OwnerContent | null }) {
  const d: Design = { ...designIn, font: fontStack(designIn.font), headingFont: fontStack(designIn.headingFont) };
  const experience = getBusinessExperience(store.business.category, { sellsProducts: store.business.sellsProducts, offersServices: store.business.offersServices }, store.business.businessSubcategory);
  const isService = experience.mode === "service";
  const width = d.containerWidth === "compact" ? 960 : d.containerWidth === "wide" ? 1320 : 1160;
  const base = `/store/${store.slug}`;
  const line = `${d.text}1f`;
  const storeLinks = [
    { label: "Home", href: base },
    { label: isService ? "Services" : "Shop", href: `${base}/catalog` },
    ...(isService ? [] : [{ label: "Categories", href: `${base}/categories` }]),
    { label: "About", href: `${base}/about` },
    { label: "Contact", href: `${base}/contact` },
  ];
  const copy = owner ? { ...COPY[kind], title: owner.title, subtitle: kind === "about" || kind === "contact" ? COPY[kind].subtitle : "" } : COPY[kind];
  const rad = skin ? RADIUS_PX[skin.radius] : d.radius;
  const card: React.CSSProperties = (() => {
    switch (skin?.surface) {
      case "flat": return { background: `${d.text}0a`, borderRadius: rad };
      case "outlined-heavy": return { background: d.surface, border: `2px solid ${d.text}`, borderRadius: rad };
      case "tinted": return { background: `${d.primary}14`, border: `1px solid ${d.primary}33`, borderRadius: rad };
      case "shadow": return { background: d.surface, boxShadow: "0 12px 32px -14px rgba(0,0,0,.28)", borderRadius: rad };
      default: return { background: d.surface, border: `1px solid ${line}`, borderRadius: rad };
    }
  })();
  const btnRadius = skin ? (skin.radius === "pill" ? 999 : skin.radius === "sharp" ? 0 : skin.radius === "round" ? 14 : 8) : d.buttonStyle === "pill" ? 999 : d.radius;
  const btn = (primary: boolean): React.CSSProperties => ({
    display: "inline-block", padding: skin?.density === "compact" ? "9px 16px" : "12px 22px", fontWeight: 750, fontSize: 14, borderRadius: btnRadius,
    background: primary ? d.primary : "transparent", color: primary ? readableOn(d.primary) : d.text, border: `1px solid ${primary ? d.primary : line}`,
  });
  const gap = skin?.density === "airy" ? 56 : skin?.density === "compact" ? 28 : 40;
  const hdr = skin?.header ?? "line";
  const gal = skin?.gallery ?? "left";
  const lay = skin?.layout ?? "summary-right";
  const titleWeight = skin?.weight === "light" ? 300 : skin?.weight === "medium" ? 600 : 800;
  const cols = skin?.grid === "dense" ? 4 : skin?.grid === "roomy" || skin?.grid === "feature" ? 2 : 3;

  let body: ReactNode;
  if (kind === "about") {
    const desc = owner?.body || store.business.description?.trim() || `${store.name} is a local business. Browse what we offer and get in touch any time.`;
    body = (
      <>
        <div className="bn-grid" style={{ gridTemplateColumns: !data.storyImage || gal === "stacked" ? "1fr" : gal === "wide" ? "1.5fr 1fr" : gal === "tall" ? "1fr 1fr" : "1.1fr .9fr", alignItems: "center", gap }}>
          <div>
            <small style={{ color: d.accent, fontWeight: 800, letterSpacing: ".14em", textTransform: "uppercase" }}>Our story</small>
            <h2 style={{ fontFamily: d.headingFont, fontSize: 34, lineHeight: 1.15, margin: "10px 0 16px" }}>Built around what matters</h2>
            {owner?.blocks?.length
              ? <PageBlocks blocks={owner.blocks} catalog={owner.catalog} slug={store.slug} tokens={{ text: d.muted, accent: d.accent, primary: d.primary, line, radius: d.radius, headingFont: d.headingFont }} />
              : <p style={{ color: d.muted, lineHeight: 1.8, fontSize: 16, whiteSpace: "pre-line" }}>{desc}</p>}
            <div style={{ display: "flex", gap: 12, flexWrap: "wrap", marginTop: 24 }}>
              <Link href={`${base}/catalog`} style={btn(true)}>{isService ? "See our services" : "Shop now"}</Link>
              <Link href={`${base}/contact`} style={btn(false)}>Contact us</Link>
            </div>
          </div>
          {data.storyImage && <div style={{ order: gal === "right" || gal === "thumbs-side" ? -1 : gal === "stacked" ? -1 : 0, aspectRatio: gal === "tall" ? "4/5" : gal === "stacked" ? "21/9" : "4/3", borderRadius: rad, background: `url(${cssUrl(data.storyImage)}) center/cover`, border: `1px solid ${line}`, boxShadow: gal === "thumbs-side" ? `14px 14px 0 ${d.primary}33` : undefined }} />}
        </div>
        <div className="bn-grid" style={{ gridTemplateColumns: "repeat(3,1fr)", textAlign: skin?.items === "ruled" || skin?.items === "compact" ? "left" : "center", marginTop: gap + 8 }}>
          {[
            { v: `${data.itemCount}+`, l: isService ? "Services" : "Products & services" },
            { v: data.completedOrders > 0 ? `${data.completedOrders}+` : "New", l: isService ? "Completed bookings" : "Completed orders" },
            { v: data.avgRating ? `${data.avgRating.toFixed(1)}/5` : "New", l: "Customer rating" },
          ].map((s) => (
            <div key={s.l} style={skin?.cards === "plain" ? { padding: "6px 0 6px 18px", borderLeft: `3px solid ${d.accent}` } : { ...card, padding: skin?.density === "compact" ? 14 : 22 }}>
              <div style={{ fontFamily: d.headingFont, fontSize: skin?.grid === "feature" ? 40 : 30, fontWeight: titleWeight }}>{s.v}</div>
              <div style={{ color: d.muted, fontSize: 12 }}>{s.l}</div>
            </div>
          ))}
        </div>
        {data.reviews.length > 0 && (
          <div style={{ marginTop: 48 }}>
            <h2 style={{ fontFamily: d.headingFont, fontSize: 26, marginBottom: 18 }}>What customers say</h2>
            <div className="bn-grid" style={{ gridTemplateColumns: skin?.items === "compact" || skin?.items === "ruled" ? "1fr" : "repeat(3,1fr)" }}>
              {data.reviews.map((r) => (
                <div key={r.id} style={skin?.items === "ruled" ? { borderLeft: `3px solid ${d.accent}`, padding: "4px 0 4px 20px", maxWidth: 760 } : { ...card, padding: 22 }}>
                  <div style={{ color: d.accent }}>{starFill(r.rating)}{starEmpty(r.rating)}</div>
                  <p style={{ lineHeight: 1.7, color: d.muted }}>{r.comment}</p>
                  <strong style={{ fontSize: 13 }}>{r.author}</strong>
                </div>
              ))}
            </div>
          </div>
        )}
      </>
    );
  } else if (kind === "contact") {
    const tile = (icon: ReactNode, label: string, value: string, href?: string) => {
      const inner = (
        <div style={{ ...card, padding: 20, display: "flex", gap: 14, alignItems: "center" }}>
          <span style={{ width: 42, height: 42, borderRadius: 999, background: d.primary, color: readableOn(d.primary), display: "grid", placeItems: "center", flex: "0 0 auto" }}>{icon}</span>
          <div><small style={{ color: d.muted }}>{label}</small><div style={{ fontWeight: 750, marginTop: 3 }}>{value}</div></div>
        </div>
      );
      return href ? <a key={label} href={href}>{inner}</a> : <div key={label}>{inner}</div>;
    };
    body = (
      <>
      {owner && (owner.blocks?.length
        ? <div style={{ margin: "0 0 32px" }}><PageBlocks blocks={owner.blocks} catalog={owner.catalog} slug={store.slug} tokens={{ text: d.muted, accent: d.accent, primary: d.primary, line, radius: d.radius, headingFont: d.headingFont }} /></div>
        : <p style={{ color: d.muted, lineHeight: 1.8, fontSize: 16, whiteSpace: "pre-line", maxWidth: 760, margin: "0 0 32px" }}>{owner.body}</p>)}
      <div className="bn-grid" style={{ gridTemplateColumns: lay === "single" || lay === "summary-top" ? "1fr" : lay === "wide-form" ? "1.7fr .8fr" : lay === "split-bleed" ? "1fr 1fr" : lay === "narrow-centre" ? "1fr" : "1.3fr .9fr", gap: 28, alignItems: "start", maxWidth: lay === "narrow-centre" || lay === "single" ? 640 : undefined, margin: lay === "narrow-centre" ? "0 auto" : undefined }}>
        {/* The form's own stylesheet (.bn-contact-form in globals.css) is light; keep its text dark on any design. */}
        <div style={{ color: "#111", order: lay === "summary-left" || lay === "summary-top" || lay === "single" ? 2 : 0 }}>
          <ContactEnquiryForm slug={store.slug} accent={d.accent} phonePlaceholder={store.contactPhone || undefined} subjects={["General enquiry", isService ? "Booking / availability" : "Order support", "Something else"]} />
        </div>
        <div style={{ display: "grid", gap: 14, order: lay === "summary-left" || lay === "summary-top" || lay === "single" ? 1 : 1 }}>
          {store.contactPhone && tile(<Phone size={18} />, "Call us", store.contactPhone, `tel:${store.contactPhone}`)}
          {store.contactEmail && tile(<Mail size={18} />, "Email us", store.contactEmail, `mailto:${store.contactEmail}`)}
          {tile(<MapPin size={18} />, "Location", data.location || "Contact us for location details.")}
        </div>
      </div>
      </>
    );
  } else if ((kind === "gallery" || kind === "blog") && owner?.blocks?.length) {
    // Written with the block editor. Pages saved before blocks existed fall through to the text readers below.
    body = <PageBlocks blocks={owner.blocks} catalog={owner.catalog} wide={kind === "gallery"} slug={store.slug} tokens={{ text: d.muted, accent: d.accent, primary: d.primary, line, radius: d.radius, headingFont: d.headingFont }} />;
  } else if (kind === "gallery") {
    const g = parseGalleryBody(owner?.body ?? "");
    body = (
      <>
        {g.intro && <p style={{ color: d.muted, lineHeight: 1.8, fontSize: 16, whiteSpace: "pre-line", maxWidth: 760, margin: "0 0 32px" }}>{g.intro}</p>}
        {g.images.length > 0 && (
          <div className="bn-grid" style={{ gridTemplateColumns: "repeat(3,1fr)" }}>
            {g.images.map((img, i) => (
              <figure key={`${img.url}-${i}`} style={{ margin: 0 }}>
                <div role="img" aria-label={img.caption || `${store.name} photo ${i + 1}`} style={{ aspectRatio: "1/1", borderRadius: d.radius, background: `url(${cssUrl(img.url)}) center/cover`, border: `1px solid ${line}` }} />
                {img.caption && <figcaption style={{ color: d.muted, fontSize: 13, marginTop: 8 }}>{img.caption}</figcaption>}
              </figure>
            ))}
          </div>
        )}
      </>
    );
  } else if (kind === "blog") {
    const posts = parseBlogPosts(owner?.body ?? "");
    body = (
      <div style={{ display: "grid", gap: 20, maxWidth: 820 }}>
        {posts.map((post, i) => (
          <article key={`${post.title}-${i}`} style={{ ...card, padding: 28 }}>
            <h2 style={{ fontFamily: d.headingFont, fontSize: 26, lineHeight: 1.2, margin: 0 }}>{post.title}</h2>
            {post.text && <p style={{ color: d.muted, lineHeight: 1.8, fontSize: 16, whiteSpace: "pre-line", margin: "14px 0 0" }}>{post.text}</p>}
          </article>
        ))}
      </div>
    );
  } else {
    body = data.categories.length === 0 ? (
      <div style={{ ...card, padding: 40, textAlign: "center" }}>
        <h2 style={{ fontFamily: d.headingFont, fontSize: 22 }}>No categories yet</h2>
        <p style={{ color: d.muted, margin: "8px 0 20px" }}>This store hasn't organised its items into categories.</p>
        <Link href={`${base}/catalog`} style={btn(true)}>Browse everything</Link>
      </div>
    ) : (
      <div className="bn-grid" style={{ gridTemplateColumns: `repeat(${cols},1fr)`, gap: skin?.density === "airy" ? 28 : 20 }}>
        {data.categories.map((c) => (
          <div key={c.id} style={{ ...card, padding: skin?.grid === "feature" ? 34 : 22 }}>
            <Link href={`${base}/catalog?category=${encodeURIComponent(c.name)}`} style={{ display: "block" }}>
              <h3 style={{ fontFamily: d.headingFont, fontSize: 19, margin: 0 }}>{c.name}</h3>
              <p style={{ color: d.muted, fontSize: 13, margin: "6px 0 0" }}>{c.count} {c.count === 1 ? "item" : "items"}</p>
            </Link>
            {c.children.length > 0 && (
              <div style={{ display: "flex", flexWrap: "wrap", gap: 8, marginTop: 14 }}>
                {c.children.map((ch) => (
                  <Link key={ch.id} href={`${base}/catalog?category=${encodeURIComponent(ch.name)}`} style={{ fontSize: 12, fontWeight: 650, padding: "6px 12px", borderRadius: 999, border: `1px solid ${line}`, color: d.text }}>
                    {ch.name} · {ch.count}
                  </Link>
                ))}
              </div>
            )}
          </div>
        ))}
      </div>
    );
  }

  return (
    <main style={{ background: d.background, color: d.text, fontFamily: d.font, minHeight: "100vh" }}>
      <style>{`a{text-decoration:none;color:inherit}.bn-wrap{width:min(${width}px,calc(100% - 32px));margin:0 auto}.bn-grid{display:grid;gap:20px}@media(max-width:720px){.bn-nav-links{display:none!important}.bn-grid{grid-template-columns:1fr!important}}`}</style>
      <BuilderHeader store={store} d={d} experience={experience} visible={[]} />
      {(() => {
        const solid = hdr === "band";
        const fg = solid ? readableOn(d.primary) : d.text;
        const mu = solid ? `${readableOn(d.primary)}cc` : d.muted;
        const centred = hdr === "centre";
        return (
          <section style={{ background: solid ? d.primary : hdr === "plain" ? d.background : d.surface, borderBottom: hdr === "plain" ? "none" : hdr === "split" ? `4px solid ${d.accent}` : `1px solid ${line}`, textAlign: centred ? "center" : undefined }}>
            <div className="bn-wrap" style={{ padding: hdr === "plain" ? "72px 0 12px" : hdr === "split" ? "26px 0 24px" : "44px 0 34px" }}>
              <nav aria-label="Breadcrumb" style={{ fontSize: 13, color: mu, marginBottom: 14 }}>
                <Link href={base}>Home</Link> / <span style={{ color: fg }}>{copy.title}</span>
              </nav>
              <h1 style={{ fontFamily: d.headingFont, fontSize: hdr === "plain" ? 56 : 40, lineHeight: 1.1, margin: centred ? "0 auto" : 0, color: fg, fontWeight: titleWeight, letterSpacing: titleWeight === 300 ? 0 : undefined }}>{kind === "categories" && isService ? "Services" : copy.title}</h1>
              {copy.subtitle && <p style={{ color: mu, margin: centred ? "10px auto 0" : "10px 0 0", maxWidth: 640 }}>{copy.subtitle}</p>}
            </div>
          </section>
        );
      })()}
      <div className="bn-wrap" style={{ padding: "48px 0 8px" }}>{body}</div>
      <BuilderFooter store={store} d={d} visible={[]} storeLinks={storeLinks} />
    </main>
  );
}
