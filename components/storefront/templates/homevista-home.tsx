import type React from "react";
import { CartLink } from "@/components/storefront/cart-link";
import { HOMEVISTA, HOMEVISTA_THEME } from "@/lib/template-themes";
import { subscribeToNewsletter } from "@/lib/actions/newsletter";
import { CategoryNav } from "@/components/storefront/category-nav";
import { Reveal } from "@/components/storefront/reveal";
import type { CategoryTreeNode } from "@/lib/storefront-categories";

// Ported from the HomeVista Real Estate template (homevista_nextjs_template.zip).
// Per its own README ("Replace lib/mock-data.ts with your existing
// Prisma/API layer" / "keep your existing auth, database, and payment
// implementations"), this component reuses the template's real-estate
// layout and design tokens (green/teal palette, search bar, property-type
// grid, listing cards, agent-style "why choose us" strip) but is fed the
// same real store data (name, logo, banner, catalog, reviews, contact
// info) as the other templates — listings are the store's own
// products/services (e.g. rental-type products), not the template's mock
// properties. All imagery still comes from the store owner's own uploads.

type CatalogItem = {
  id: string; kind: "product" | "service"; name: string; description: string | null;
  price: number; currency: string; image: string | null; categoryName: string | null;
  type: string; rentalUnit: string | null; isBookable: boolean;
};
type Review = { id: string; rating: number; comment: string | null; author: { name: string | null } };

const wrap: React.CSSProperties = { width: "90%", maxWidth: 1200, margin: "0 auto" };

export function HomeVistaStorefront({
  store, slug, catalogItems, navCategories, goodReviews, avgRating, completedOrders, social,
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
  completedOrders: number;
  social: Record<string, string>;
}) {
  async function subscribeNewsletter(formData: FormData) {
    "use server";
    await subscribeToNewsletter(slug, formData);
  }
  const heroImage = store.bannerUrl;
  const featuredItems = catalogItems.slice(0, 5);
  const heroListing = catalogItems[0];

  return (
    <div style={{ background: "#fff", color: HOMEVISTA.ink, fontFamily: HOMEVISTA.font, fontSize: 13, minHeight: "100vh" }}>
      {/* ---------- TOPBAR ---------- */}
      <div style={{ height: 30, background: HOMEVISTA.topbar, display: "flex", justifyContent: "space-between", alignItems: "center", padding: "0 4.5%", fontSize: 9, color: "#526164" }}>
        <span>{store.contactEmail ? `✉ ${store.contactEmail}` : ""} {store.contactPhone ? `☎ ${store.contactPhone}` : ""}</span>
        <span>{Object.keys(social).length > 0 ? "Follow us" : ""}</span>
      </div>

      {/* ---------- NAV ---------- */}
      <header style={{ height: 70, display: "flex", alignItems: "center", padding: "0 4.5%", gap: 28, borderBottom: "1px solid #edf0ef", background: "#fff" }}>
        <a href={`/store/${slug}`} style={{ fontSize: 19, color: HOMEVISTA.dark, minWidth: 175, textDecoration: "none", display: "flex", alignItems: "center", gap: 8 }}>
          {store.logoUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={store.logoUrl} alt={store.name} style={{ height: 32, width: 32, borderRadius: "50%", objectFit: "cover" }} />
          ) : (
            <span>⌂</span>
          )}
          <b>{store.name}</b>
        </a>
        <nav style={{ display: "flex", gap: 25, fontSize: 11, fontWeight: 700 }}>
          {catalogItems.length > 0 && <a href="#listings" style={{ color: HOMEVISTA.accent, borderBottom: `2px solid ${HOMEVISTA.accent}`, paddingBottom: 25, textDecoration: "none" }}>Listings</a>}
          {navCategories.length > 0 && <a href={`/store/${slug}/catalog`} style={{ textDecoration: "none", color: HOMEVISTA.ink }}>Categories</a>}
        </nav>
        <div style={{ marginLeft: "auto", display: "flex", alignItems: "center", gap: 20 }}>
          <CartLink storeSlug={slug} accent={HOMEVISTA.accent} ink={HOMEVISTA.ink} />
        </div>
      </header>

      <CategoryNav slug={slug} categories={navCategories} accent={HOMEVISTA.accent} ink={HOMEVISTA.ink} bg="#fff" border="#edf0ef" />

      {/* ---------- HERO ---------- */}
      <section
        style={{
          height: 345, position: "relative", overflow: "hidden",
          background: heroImage
            ? `linear-gradient(100deg, rgba(15,45,40,.7) 0%, rgba(15,45,40,.4) 40%, rgba(15,45,40,.08) 70%), url(${heroImage}) center/cover`
            : `linear-gradient(100deg,#f7faf9 0%,#f7faf9 38%,#dae5e2 65%,#9fb8b2 100%)`,
        }}
      >
        <div style={{ position: "absolute", left: "5%", top: 55, width: "44%", zIndex: 2 }}>
          <h1 style={{ fontSize: 38, lineHeight: 1.1, letterSpacing: "-1.5px", margin: "0 0 13px", color: heroImage ? "#fff" : HOMEVISTA.ink }}>
            {store.name}
          </h1>
          <p style={{ maxWidth: 400, color: heroImage ? "rgba(255,255,255,.85)" : "#556266", fontSize: 13, lineHeight: 1.55 }}>
            {store.business.description || HOMEVISTA_THEME.sub}
          </p>
          {catalogItems.length > 0 && (
            <a href="#listings" style={{ display: "inline-block", background: HOMEVISTA.accent, color: "#fff", border: 0, borderRadius: 7, padding: "12px 18px", fontWeight: 800, fontSize: 10, margin: "4px 6px 0 0", textDecoration: "none" }}>
              {HOMEVISTA_THEME.cta} →
            </a>
          )}
        </div>
        {heroListing && (
          <div style={{ position: "absolute", right: "5%", bottom: 20, background: "#fff", borderRadius: 12, padding: "12px 18px", boxShadow: "0 5px 22px #193b3218", zIndex: 3, minWidth: 190, fontSize: 9 }}>
            ⌂ <b style={{ fontSize: 10 }}>{heroListing.name}</b>
            {heroListing.categoryName && <small style={{ display: "block", color: "#677276", margin: "5px 0" }}>{heroListing.categoryName}</small>}
            <strong style={{ fontSize: 13, color: HOMEVISTA.accent }}>{heroListing.currency} {heroListing.price.toLocaleString()}</strong>
          </div>
        )}
      </section>

      {/* ---------- PROPERTY TYPES ---------- */}
      {navCategories.length > 0 && (
        <section style={{ ...wrap, margin: "25px auto" }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 10 }}>
            <h2 style={{ fontSize: 18, margin: 0 }}>Explore Categories</h2>
            <a href={`/store/${slug}/catalog`} style={{ color: HOMEVISTA.accent, fontSize: 10, fontWeight: 800, textDecoration: "none" }}>View All →</a>
          </div>
          <div style={{ display: "grid", gridTemplateColumns: `repeat(${Math.min(navCategories.length, 6)}, 1fr)`, gap: 9 }}>
            {navCategories.slice(0, 6).map((c) => (
              <a key={c.id} href={`/store/${slug}/category/${c.id}`} style={{ border: "1px solid #e6ebe9", borderRadius: 8, padding: 11, display: "flex", alignItems: "center", gap: 10, boxShadow: "0 2px 8px #18352d08", textDecoration: "none", color: HOMEVISTA.ink }}>
                <span style={{ fontSize: 25 }}>⌂</span>
                <div>
                  <b style={{ fontSize: 10 }}>{c.name}</b>
                  <small style={{ display: "block", fontSize: 8, color: "#7b8588", marginTop: 4 }}>{c.count} Listings</small>
                </div>
              </a>
            ))}
          </div>
        </section>
      )}

      {/* ---------- FEATURED LISTINGS ---------- */}
      {featuredItems.length > 0 && (
        <section id="listings" style={{ ...wrap, margin: "25px auto" }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 10 }}>
            <h2 style={{ fontSize: 18, margin: 0 }}>Featured Listings</h2>
            <a href={`/store/${slug}/catalog`} style={{ color: HOMEVISTA.accent, fontSize: 10, fontWeight: 800, textDecoration: "none" }}>View All →</a>
          </div>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(5, 1fr)", gap: 10 }}>
            {featuredItems.map((item, i) => (
              <Reveal key={`${item.kind}-${item.id}`} delayMs={i * 40}>
                <a href={`/store/${slug}/${item.kind === "product" ? "product" : "service"}/${item.id}`} style={{ border: "1px solid #e2e8e6", borderRadius: 8, overflow: "hidden", background: "#fff", display: "block", textDecoration: "none", color: HOMEVISTA.ink }}>
                  <div style={{ height: 125, background: "#d8e0de", position: "relative" }}>
                    {item.image ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={item.image} alt={item.name} style={{ width: "100%", height: "100%", objectFit: "cover" }} />
                    ) : null}
                    {item.rentalUnit && (
                      <span style={{ position: "absolute", top: 8, left: 8, background: "#fff", padding: "5px 7px", borderRadius: 4, fontSize: 8, fontWeight: 800 }}>Per {item.rentalUnit}</span>
                    )}
                  </div>
                  <div style={{ padding: 9 }}>
                    <h3 style={{ fontSize: 10, margin: "0 0 5px" }}>{item.name}</h3>
                    {item.categoryName && <small style={{ fontSize: 8, color: "#758084" }}>{item.categoryName}</small>}
                    <strong style={{ display: "block", color: HOMEVISTA.accent, fontSize: 13, margin: "6px 0" }}>{item.currency} {item.price.toLocaleString()}</strong>
                  </div>
                </a>
              </Reveal>
            ))}
          </div>
        </section>
      )}

      {/* ---------- WHY CHOOSE US ---------- */}
      {store.business.description && (
        <section style={{ ...wrap, margin: "25px auto" }}>
          <h2 style={{ fontSize: 18, marginBottom: 10 }}>Why Choose {store.name}?</h2>
          <div style={{ background: "#f6faf8", borderRadius: 5, padding: 24, display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 20 }}>
            {[["⌂", "Verified Listings", "All listings are verified and trusted."], ["$", "Best Price", "We help you find the best price possible."], ["♧", "Expert Support", "Our team is here to guide you."], ["▤", "Easy Process", "Simple and transparent from start to finish."]].map((x) => (
              <div key={x[1]} style={{ display: "flex", gap: 12, borderRight: "1px solid #dfe8e4", paddingRight: 15 }}>
                <span style={{ fontSize: 30, color: HOMEVISTA.accent }}>{x[0]}</span>
                <div>
                  <b style={{ fontSize: 11 }}>{x[1]}</b>
                  <p style={{ fontSize: 9, color: "#687477", lineHeight: 1.5 }}>{x[2]}</p>
                </div>
              </div>
            ))}
          </div>
        </section>
      )}

      {/* ---------- REVIEWS ---------- */}
      {goodReviews.length > 0 && (
        <section style={{ ...wrap, margin: "25px auto" }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 10 }}>
            <h2 style={{ fontSize: 18, margin: 0 }}>What Our Clients Say</h2>
          </div>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 12 }}>
            {goodReviews.slice(0, 3).map((r) => (
              <div key={r.id} style={{ border: "1px solid #e2e8e6", borderRadius: 8, padding: 16, minHeight: 125 }}>
                <em style={{ color: HOMEVISTA.accent, fontSize: 28, fontStyle: "normal" }}>&ldquo;</em>
                <p style={{ fontSize: 9, lineHeight: 1.6, color: "#526064" }}>{r.comment}</p>
                <b style={{ fontSize: 9, display: "block" }}>{r.author.name ?? "Verified client"}</b>
                <strong style={{ color: "#eab51b", float: "right", letterSpacing: 2 }}>{"★".repeat(r.rating)}</strong>
              </div>
            ))}
          </div>
        </section>
      )}

      {/* ---------- STATS ---------- */}
      {(catalogItems.length > 0 || completedOrders > 0 || avgRating != null) && (
        <section style={{ ...wrap, margin: "25px auto", display: "flex", gap: 40, flexWrap: "wrap" }}>
          {catalogItems.length > 0 && <div><b style={{ fontSize: 22, display: "block", color: HOMEVISTA.accent }}>{catalogItems.length}+</b><span style={{ fontSize: 10, color: "#526164" }}>Listings</span></div>}
          {completedOrders > 0 && <div><b style={{ fontSize: 22, display: "block", color: HOMEVISTA.accent }}>{completedOrders}+</b><span style={{ fontSize: 10, color: "#526164" }}>Deals closed</span></div>}
          {avgRating != null && <div><b style={{ fontSize: 22, display: "block", color: HOMEVISTA.accent }}>{avgRating.toFixed(1)}/5</b><span style={{ fontSize: 10, color: "#526164" }}>Average rating</span></div>}
        </section>
      )}

      {/* ---------- NEWSLETTER ---------- */}
      <section style={{ ...wrap, margin: "25px auto" }}>
        <div style={{ background: HOMEVISTA.dark, borderRadius: 8, padding: "22px 25px", color: "#fff", display: "flex", alignItems: "center", gap: 30, flexWrap: "wrap" }}>
          <div>
            <h2 style={{ fontSize: 18, margin: "0 0 5px" }}>Get Exclusive Updates</h2>
            <p style={{ fontSize: 9, color: "#c4d3d0" }}>Subscribe for new listings and special offers from {store.name}.</p>
          </div>
          <form action={subscribeNewsletter} style={{ marginLeft: "auto", display: "flex", background: "#fff", borderRadius: 6, overflow: "hidden", width: 360 }}>
            <input type="hidden" name="slug" value={slug} />
            <input name="email" type="email" required placeholder="Enter your email address" style={{ border: 0, outline: 0, padding: 12, flex: 1, fontSize: 9 }} />
            <button type="submit" style={{ border: 0, background: HOMEVISTA.accent, color: "#fff", padding: "0 16px", fontSize: 10, fontWeight: 800, cursor: "pointer" }}>Subscribe</button>
          </form>
        </div>
      </section>

      {/* ---------- FOOTER ---------- */}
      <footer style={{ background: HOMEVISTA.footer, color: "#fff", marginTop: 12, padding: "30px 5%", display: "grid", gridTemplateColumns: "1.5fr repeat(4, 1fr)", gap: 25 }}>
        <div>
          <b style={{ fontSize: 18 }}>⌂ {store.name}</b>
          <p style={{ color: "#b8cbc7", fontSize: 8, margin: "7px 0" }}>{store.business.description || "Your trusted partner in finding the perfect place."}</p>
        </div>
        <div>
          <b style={{ fontSize: 11 }}>Quick Links</b>
          <a href={`/store/${slug}/catalog`} style={{ display: "block", color: "#b8cbc7", fontSize: 8, margin: "7px 0", textDecoration: "none" }}>Listings</a>
          <a href={`/store/${slug}/cart`} style={{ display: "block", color: "#b8cbc7", fontSize: 8, margin: "7px 0", textDecoration: "none" }}>Cart</a>
        </div>
        <div>
          <b style={{ fontSize: 11 }}>Contact</b>
          {store.contactEmail && <p style={{ color: "#b8cbc7", fontSize: 8, margin: "7px 0" }}>{store.contactEmail}</p>}
          {store.contactPhone && <p style={{ color: "#b8cbc7", fontSize: 8, margin: "7px 0" }}>{store.contactPhone}</p>}
        </div>
        <div>
          <b style={{ fontSize: 11 }}>Follow</b>
          {Object.entries(social).map(([k, v]) => (
            <a key={k} href={v} style={{ display: "block", color: "#b8cbc7", fontSize: 8, margin: "7px 0", textDecoration: "none" }}>{k}</a>
          ))}
        </div>
        <small style={{ gridColumn: "1/-1", borderTop: "1px solid #294a46", paddingTop: 12, color: "#9eb4b0", fontSize: 8 }}>© {new Date().getFullYear()} {store.name}. All rights reserved.</small>
      </footer>
    </div>
  );
}
