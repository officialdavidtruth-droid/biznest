import type React from "react";
import { TrustBadge } from "@/components/storefront/trust-badge";
import { CartLink } from "@/components/storefront/cart-link";
import { ARCOVA } from "@/lib/template-themes";
import { CategoryNav } from "@/components/storefront/category-nav";
import { Reveal } from "@/components/storefront/reveal";
import type { CategoryTreeNode } from "@/lib/storefront-categories";

// Ported from the Arcova architecture/agency template
// (arcova-react-nestjs.zip). The source project was a standalone Vite +
// React Router frontend backed by its own NestJS API with hardcoded
// project/service data and a contact form posting to that API. None of
// that backend is used here -- only its dark editorial layout (split
// hero + stats strip, featured-projects grid, services rail, numbered
// process steps, journal/insights strip, closing CTA) is reused, fed by
// the store's own real products/services/reviews/contact info, same as
// every other template on the platform. "Projects" maps to the store's
// catalog items (its own products/services), "Services" maps directly to
// the store's own Service listings. The process steps and section eyebrow
// copy are fixed per-template microcopy, same as every other template's
// static section labels -- not real store data.

type CatalogItem = {
  id: string; kind: "product" | "service"; name: string; description: string | null;
  price: number; currency: string; image: string | null; categoryName: string | null;
  type: string; rentalUnit: string | null; isBookable: boolean;
};
type Review = { id: string; rating: number; comment: string | null; author: { name: string | null } };

const wrap: React.CSSProperties = { width: "88%", maxWidth: 1180, margin: "0 auto" };

const PROCESS_STEPS = [
  ["01", "Discover", "Understand your vision, goals, and requirements."],
  ["02", "Design", "Crafting intelligent designs that inspire and perform."],
  ["03", "Build", "Expert execution with quality and precision."],
  ["04", "Deliver", "On-time delivery with attention to every detail."],
];

export function ArcovaStorefront({
  store, slug, catalogItems, navCategories, goodReviews, avgRating, completedOrders, trustScore, social,
}: {
  store: {
    name: string; logoUrl: string | null; bannerUrl: string | null;
    contactEmail: string | null; contactPhone: string | null;
    business: { description: string | null };
  };
  slug: string;
  catalogItems: CatalogItem[];
  navCategories: CategoryTreeNode[];
  goodReviews: Review[];
  avgRating: number | null;
  trustScore: number | null;
  completedOrders: number;
  social: Record<string, string>;
}) {
  const featured = catalogItems.slice(0, 4);
  const services = catalogItems.filter((i) => i.kind === "service").slice(0, 5);
  const heroImage = store.bannerUrl;

  return (
    <div style={{ background: ARCOVA.paper, color: ARCOVA.ink, fontFamily: ARCOVA.font, minHeight: "100vh" }}>
      {/* ---------- NAV ---------- */}
      <header style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "22px 0", borderBottom: `1px solid ${ARCOVA.border}` }}>
        <div style={wrap}>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
            <a href={`/store/${slug}`} style={{ textDecoration: "none", color: ARCOVA.ink, display: "flex", alignItems: "center", gap: 10 }}>
              {store.logoUrl ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={store.logoUrl} alt={store.name} style={{ height: 32, width: "auto" }} />
              ) : null}
              <span style={{ fontSize: 18, fontWeight: 700, letterSpacing: 1 }}>{store.name.toUpperCase()}</span>
            </a>
            <nav style={{ display: "flex", alignItems: "center", gap: 26, fontSize: 12, letterSpacing: 1 }}>
              <a href="#projects" style={{ color: ARCOVA.ink, textDecoration: "none" }}>PROJECTS</a>
              <a href="#services" style={{ color: ARCOVA.ink, textDecoration: "none" }}>SERVICES</a>
              <a href="#contact" style={{ color: ARCOVA.ink, textDecoration: "none" }}>CONTACT</a>
              <CartLink storeSlug={slug} accent={ARCOVA.accent} onAccent="#ffffff" ink={ARCOVA.ink} />
            </nav>
          </div>
        </div>
      </header>

      <CategoryNav slug={slug} categories={navCategories} accent={ARCOVA.accent} ink={ARCOVA.ink} bg="transparent" border={ARCOVA.border} />

      {/* ---------- HERO ---------- */}
      <section style={{ padding: "70px 0", background: heroImage ? `linear-gradient(180deg, rgba(20,20,20,0.55), rgba(20,20,20,0.55)), url(${heroImage}) center/cover` : ARCOVA.paper, color: heroImage ? "#fff" : ARCOVA.ink }}>
        <div style={{ ...wrap, display: "grid", gridTemplateColumns: "1.2fr 1fr", gap: 40, alignItems: "end" }}>
          <div>
            <div style={{ fontSize: 11, letterSpacing: 2, opacity: 0.7, marginBottom: 14 }}>ARCHITECTURE THAT INSPIRES</div>
            <h1 style={{ fontSize: "clamp(32px, 5vw, 54px)", fontWeight: 700, lineHeight: 1.08, margin: "0 0 18px" }}>
              We build <span style={{ color: ARCOVA.accent }}>timeless</span> spaces.<br />Built around you.
            </h1>
            <p style={{ fontSize: 15, opacity: 0.85, maxWidth: 460, marginBottom: 26 }}>
              {store.business.description || "From concept to completion, we craft extraordinary spaces that elevate living and stand the test of time."}
            </p>
            <a href="#projects" style={{ display: "inline-block", padding: "13px 26px", background: ARCOVA.accent, color: "#141414", fontSize: 12, letterSpacing: 1, textDecoration: "none", fontWeight: 700 }}>
              EXPLORE OUR WORK &rarr;
            </a>
          </div>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 18, fontSize: 12 }}>
            {[["15+", "Years of experience"], [String(catalogItems.length || 0), "Active listings"], [avgRating ? avgRating.toFixed(1) : "New", "Average rating"], [String(completedOrders), "Completed orders"]].map(([n, label]) => (
              <div key={label} style={{ border: `1px solid ${heroImage ? "rgba(255,255,255,0.35)" : ARCOVA.border}`, padding: "16px 14px" }}>
                <b style={{ fontSize: 22, display: "block" }}>{n}</b>
                <span style={{ opacity: 0.75 }}>{label}</span>
              </div>
            ))}
          </div>
          {trustScore != null && <TrustBadge score={trustScore} style={{ marginTop: 14 }} />}
        </div>
      </section>

      {/* ---------- FEATURED PROJECTS ---------- */}
      <section id="projects" style={{ padding: "70px 0" }}>
        <Reveal>
          <div style={wrap}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-end", marginBottom: 34, flexWrap: "wrap", gap: 16 }}>
              <div>
                <div style={{ fontSize: 11, letterSpacing: 2, color: ARCOVA.accent, marginBottom: 8 }}>FEATURED PROJECTS</div>
                <h2 style={{ fontSize: 30, fontWeight: 700, margin: 0 }}>Spaces that define excellence</h2>
              </div>
              <a href={`/store/${slug}/catalog`} style={{ fontSize: 12, letterSpacing: 1, color: ARCOVA.ink, textDecoration: "none", borderBottom: `1px solid ${ARCOVA.ink}`, paddingBottom: 3 }}>
                VIEW ALL &rarr;
              </a>
            </div>
            {featured.length === 0 ? (
              <p style={{ opacity: 0.6, fontSize: 14 }}>No listings published yet -- check back soon.</p>
            ) : (
              <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(260px, 1fr))", gap: 20 }}>
                {featured.map((item) => (
                  <a key={item.id} href={`/store/${slug}/${item.kind}/${item.id}`} style={{ textDecoration: "none", color: ARCOVA.ink, display: "block" }}>
                    <div style={{ aspectRatio: "4/3", background: item.image ? `url(${item.image}) center/cover` : "#eee" }} />
                    <div style={{ padding: "14px 0" }}>
                      <h3 style={{ fontSize: 16, margin: "0 0 4px" }}>{item.name}</h3>
                      <small style={{ opacity: 0.6 }}>{item.categoryName || (item.kind === "product" ? "Product" : "Service")}</small>
                    </div>
                  </a>
                ))}
              </div>
            )}
          </div>
        </Reveal>
      </section>

      {/* ---------- SERVICES ---------- */}
      <section id="services" style={{ padding: "70px 0", background: ARCOVA.dark, color: "#fff" }}>
        <Reveal>
          <div style={wrap}>
            <div style={{ fontSize: 11, letterSpacing: 2, color: ARCOVA.accent, marginBottom: 8 }}>OUR SERVICES</div>
            <h2 style={{ fontSize: 28, fontWeight: 700, margin: "0 0 30px" }}>End-to-end solutions</h2>
            {services.length === 0 ? (
              <p style={{ opacity: 0.6, fontSize: 14 }}>Services will appear here once published.</p>
            ) : (
              <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(220px, 1fr))", gap: 20 }}>
                {services.map((s) => (
                  <a key={s.id} href={`/store/${slug}/service/${s.id}`} style={{ textDecoration: "none", color: "#fff", border: "1px solid rgba(255,255,255,0.15)", padding: 22 }}>
                    <h3 style={{ fontSize: 16, margin: "0 0 8px" }}>{s.name}</h3>
                    <p style={{ fontSize: 13, opacity: 0.65, margin: 0 }}>{s.description || `Starting at ${s.currency} ${s.price.toLocaleString()}`}</p>
                  </a>
                ))}
              </div>
            )}
          </div>
        </Reveal>
      </section>

      {/* ---------- PROCESS ---------- */}
      <section style={{ padding: "70px 0" }}>
        <Reveal>
          <div style={wrap}>
            <div style={{ fontSize: 11, letterSpacing: 2, color: ARCOVA.accent, marginBottom: 8 }}>OUR PROCESS</div>
            <h2 style={{ fontSize: 28, fontWeight: 700, margin: "0 0 30px" }}>A seamless journey from vision to reality</h2>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))", gap: 24 }}>
              {PROCESS_STEPS.map(([num, title, text]) => (
                <div key={num}>
                  <div style={{ fontSize: 26, fontWeight: 700, color: ARCOVA.accent, marginBottom: 8 }}>{num}</div>
                  <h4 style={{ margin: "0 0 6px", fontSize: 15 }}>{title}</h4>
                  <p style={{ fontSize: 13, opacity: 0.65, margin: 0 }}>{text}</p>
                </div>
              ))}
            </div>
          </div>
        </Reveal>
      </section>

      {/* ---------- TESTIMONIALS ---------- */}
      {goodReviews.length > 0 && (
        <section style={{ padding: "60px 0", background: "#f6f5f2" }}>
          <Reveal>
            <div style={wrap}>
              <div style={{ fontSize: 11, letterSpacing: 2, color: ARCOVA.accent, marginBottom: 24 }}>WHAT CLIENTS SAY</div>
              <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(260px, 1fr))", gap: 20 }}>
                {goodReviews.slice(0, 3).map((r) => (
                  <div key={r.id} style={{ background: "#fff", padding: 22, border: `1px solid ${ARCOVA.border}` }}>
                    <p style={{ fontSize: 14, fontStyle: "italic", margin: "0 0 12px" }}>&ldquo;{r.comment}&rdquo;</p>
                    <small style={{ opacity: 0.6 }}>&mdash; {r.author.name || "Verified client"}</small>
                  </div>
                ))}
              </div>
            </div>
          </Reveal>
        </section>
      )}

      {/* ---------- CTA / CONTACT ---------- */}
      <section id="contact" style={{ padding: "70px 0", background: ARCOVA.dark, color: "#fff" }}>
        <div style={{ ...wrap, display: "grid", gridTemplateColumns: "1fr 1fr", gap: 40 }}>
          <div>
            <h2 style={{ fontSize: 30, fontWeight: 700, lineHeight: 1.15, margin: "0 0 20px" }}>
              Let&apos;s build something<br />extraordinary
            </h2>
          </div>
          <div style={{ fontSize: 14, lineHeight: 2 }}>
            <div style={{ fontSize: 11, letterSpacing: 2, color: ARCOVA.accent, marginBottom: 10 }}>CONTACT</div>
            {store.contactEmail && <p style={{ margin: 0 }}>&#9993; {store.contactEmail}</p>}
            {store.contactPhone && <p style={{ margin: 0 }}>&#9742; {store.contactPhone}</p>}
            {Object.keys(social).length > 0 && (
              <p style={{ margin: "10px 0 0", opacity: 0.7 }}>
                {Object.entries(social).map(([k, v]) => (
                  <a key={k} href={v} style={{ color: "#fff", marginRight: 14, textDecoration: "underline" }}>{k}</a>
                ))}
              </p>
            )}
          </div>
        </div>
      </section>

      {/* ---------- FOOTER ---------- */}
      <footer style={{ padding: "28px 0", borderTop: `1px solid ${ARCOVA.border}`, fontSize: 12, opacity: 0.7 }}>
        <div style={{ ...wrap, display: "flex", justifyContent: "space-between", flexWrap: "wrap", gap: 10 }}>
          <span>{store.name}</span>
          <span>&copy; {new Date().getFullYear()}</span>
        </div>
      </footer>
    </div>
  );
}
