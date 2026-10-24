"use client";

import Link from "next/link";
import type { ReactNode } from "react";
import { Mail, MapPin, Phone } from "lucide-react";
import type { BuilderConfig } from "@/lib/builder-config";
import { getBusinessExperience } from "@/lib/business-experience";
import { BuilderFooter, BuilderHeader } from "@/components/storefront/builder-renderer";
import { ContactEnquiryForm } from "@/components/storefront/contact-enquiry-form";

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
export type SubpageKind = "about" | "contact" | "categories";

const COPY: Record<SubpageKind, { title: string; subtitle: string }> = {
  about: { title: "About us", subtitle: "Who we are and what we stand for." },
  contact: { title: "Contact us", subtitle: "Questions, orders or special requests? We'd love to hear from you." },
  categories: { title: "Shop by category", subtitle: "Find exactly what you need across the whole collection." },
};

/**
 * Inner pages (About / Contact / Categories) for stores on the shared Builder renderer.
 * Uses the same BuilderHeader, BuilderFooter and design tokens as the homepage and the
 * catalogue, so every page looks like one site. (The generic "universal" pages have their
 * own header and palette, which is what made /about look like a different template.)
 */
export function BuilderSubpage({ kind, store, design: d, data }: { kind: SubpageKind; store: SubpageStore; design: Design; data: SubpageData }) {
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
  const copy = COPY[kind];
  const card: React.CSSProperties = { background: d.surface, border: `1px solid ${line}`, borderRadius: d.radius };
  const btn = (primary: boolean): React.CSSProperties => ({
    display: "inline-block", padding: "12px 22px", fontWeight: 750, fontSize: 14, borderRadius: d.buttonStyle === "pill" ? 999 : d.radius,
    background: primary ? d.primary : "transparent", color: primary ? "#fff" : d.text, border: `1px solid ${primary ? d.primary : line}`,
  });

  let body: ReactNode;
  if (kind === "about") {
    const desc = store.business.description?.trim() || `${store.name} is a local business. Browse what we offer and get in touch any time.`;
    body = (
      <>
        <div className="bn-grid" style={{ gridTemplateColumns: data.storyImage ? "1.1fr .9fr" : "1fr", alignItems: "center", gap: 40 }}>
          <div>
            <small style={{ color: d.accent, fontWeight: 800, letterSpacing: ".14em", textTransform: "uppercase" }}>Our story</small>
            <h2 style={{ fontFamily: d.headingFont, fontSize: 34, lineHeight: 1.15, margin: "10px 0 16px" }}>Built around what matters</h2>
            <p style={{ color: d.muted, lineHeight: 1.8, fontSize: 16, whiteSpace: "pre-line" }}>{desc}</p>
            <div style={{ display: "flex", gap: 12, flexWrap: "wrap", marginTop: 24 }}>
              <Link href={`${base}/catalog`} style={btn(true)}>{isService ? "See our services" : "Shop now"}</Link>
              <Link href={`${base}/contact`} style={btn(false)}>Contact us</Link>
            </div>
          </div>
          {data.storyImage && <div style={{ aspectRatio: "4/3", borderRadius: d.radius, background: `url(${data.storyImage}) center/cover`, border: `1px solid ${line}` }} />}
        </div>
        <div className="bn-grid" style={{ gridTemplateColumns: "repeat(3,1fr)", textAlign: "center", marginTop: 48 }}>
          {[
            { v: `${data.itemCount}+`, l: isService ? "Services" : "Products & services" },
            { v: data.completedOrders > 0 ? `${data.completedOrders}+` : "New", l: isService ? "Completed bookings" : "Completed orders" },
            { v: data.avgRating ? `${data.avgRating.toFixed(1)}/5` : "New", l: "Customer rating" },
          ].map((s) => (
            <div key={s.l} style={{ ...card, padding: 22 }}>
              <div style={{ fontFamily: d.headingFont, fontSize: 30, fontWeight: 800 }}>{s.v}</div>
              <div style={{ color: d.muted, fontSize: 12 }}>{s.l}</div>
            </div>
          ))}
        </div>
        {data.reviews.length > 0 && (
          <div style={{ marginTop: 48 }}>
            <h2 style={{ fontFamily: d.headingFont, fontSize: 26, marginBottom: 18 }}>What customers say</h2>
            <div className="bn-grid" style={{ gridTemplateColumns: "repeat(3,1fr)" }}>
              {data.reviews.map((r) => (
                <div key={r.id} style={{ ...card, padding: 22 }}>
                  <div style={{ color: d.accent }}>{"★".repeat(r.rating)}{"☆".repeat(5 - r.rating)}</div>
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
          <span style={{ width: 42, height: 42, borderRadius: 999, background: d.primary, color: "#fff", display: "grid", placeItems: "center", flex: "0 0 auto" }}>{icon}</span>
          <div><small style={{ color: d.muted }}>{label}</small><div style={{ fontWeight: 750, marginTop: 3 }}>{value}</div></div>
        </div>
      );
      return href ? <a key={label} href={href}>{inner}</a> : <div key={label}>{inner}</div>;
    };
    body = (
      <div className="bn-grid" style={{ gridTemplateColumns: "1.3fr .9fr", gap: 28, alignItems: "start" }}>
        {/* The form's own stylesheet (.bn-contact-form in globals.css) is light; keep its text dark on any design. */}
        <div style={{ color: "#111" }}>
          <ContactEnquiryForm slug={store.slug} accent={d.accent} phonePlaceholder={store.contactPhone || undefined} subjects={["General enquiry", isService ? "Booking / availability" : "Order support", "Something else"]} />
        </div>
        <div style={{ display: "grid", gap: 14 }}>
          {store.contactPhone && tile(<Phone size={18} />, "Call us", store.contactPhone, `tel:${store.contactPhone}`)}
          {store.contactEmail && tile(<Mail size={18} />, "Email us", store.contactEmail, `mailto:${store.contactEmail}`)}
          {tile(<MapPin size={18} />, "Location", data.location || "Contact us for location details.")}
        </div>
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
      <div className="bn-grid" style={{ gridTemplateColumns: "repeat(3,1fr)" }}>
        {data.categories.map((c) => (
          <div key={c.id} style={{ ...card, padding: 22 }}>
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
      <section style={{ background: d.surface, borderBottom: `1px solid ${line}` }}>
        <div className="bn-wrap" style={{ padding: "44px 0 34px" }}>
          <nav aria-label="Breadcrumb" style={{ fontSize: 13, color: d.muted, marginBottom: 14 }}>
            <Link href={base}>Home</Link> / <span style={{ color: d.text }}>{copy.title}</span>
          </nav>
          <h1 style={{ fontFamily: d.headingFont, fontSize: 40, lineHeight: 1.1, margin: 0 }}>{kind === "categories" && isService ? "Services" : copy.title}</h1>
          <p style={{ color: d.muted, margin: "10px 0 0", maxWidth: 640 }}>{copy.subtitle}</p>
        </div>
      </section>
      <div className="bn-wrap" style={{ padding: "48px 0 8px" }}>{body}</div>
      <BuilderFooter store={store} d={d} visible={[]} storeLinks={storeLinks} />
    </main>
  );
}
