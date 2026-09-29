import type React from "react";
import { CartLink } from "@/components/storefront/cart-link";
import { FABTEX } from "@/lib/template-themes";
import { CategoryNav } from "@/components/storefront/category-nav";
import { Reveal } from "@/components/storefront/reveal";
import type { CategoryTreeNode } from "@/lib/storefront-categories";

// Ported from the Fabtex fabric/textile B2B storefront template
// (fabtex-react-nestjs-storefront.zip): dark industrial palette, wide
// utility topbar, letter-spaced logo/nav, full-bleed hero, "welcome
// package" promo strip, three-link product band, dark feature card over a
// banner image, about/testimonials split, footer sitemap. Only the
// homepage layout is ported here (same convention as every other
// template) -- the source project's other routes (categories, cart,
// checkout, payment) map onto this platform's existing generic
// catalog/cart/checkout pages rather than being rebuilt, since those
// already carry the idempotency and payment-verification logic. Its own
// NestJS backend, localStorage cart, and sessionStorage checkout draft
// are not used.

type CatalogItem = {
  id: string; kind: "product" | "service"; name: string; description: string | null;
  price: number; currency: string; image: string | null; categoryName: string | null;
  type: string; rentalUnit: string | null; isBookable: boolean;
};
type Review = { id: string; rating: number; comment: string | null; author: { name: string | null } };

const wrap: React.CSSProperties = { padding: "0 7%" };

export function FabtexStorefront({
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
  const heroImage = store.bannerUrl;
  const featured = catalogItems.slice(0, 6);

  return (
    <div style={{ background: FABTEX.dark, color: "#ffffff", fontFamily: FABTEX.font, minHeight: "100vh" }}>
      {/* ---------- TOPBAR ---------- */}
      <div style={{ height: 30, background: "#181616", borderBottom: "1px solid #2c2929", ...wrap, display: "flex", alignItems: "center", justifyContent: "flex-end", gap: 20 }}>
        {store.contactPhone && <span style={{ fontSize: 9, color: "#aaa" }}>☎ {store.contactPhone}</span>}
        {store.contactEmail && <span style={{ fontSize: 9, color: "#aaa" }}>✉ {store.contactEmail}</span>}
      </div>

      {/* ---------- HEADER ---------- */}
      <header style={{ height: 64, background: FABTEX.dark, ...wrap, display: "flex", alignItems: "center", gap: 30, borderBottom: "1px solid #343131" }}>
        <a href={`/store/${slug}`} style={{ fontWeight: 700, fontSize: 22, letterSpacing: 6, textDecoration: "none", color: "#fff", whiteSpace: "nowrap", display: "flex", alignItems: "center", gap: 10 }}>
          {store.logoUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={store.logoUrl} alt={store.name} style={{ height: 30, width: "auto" }} />
          ) : (
            store.name.toUpperCase()
          )}
        </a>
        <nav style={{ display: "flex", gap: 2, flex: 1 }}>
          <a href="#catalog" style={{ fontSize: 10, textDecoration: "none", color: "#fff", padding: "10px 11px" }}>Catalog</a>
          <a href="#about" style={{ fontSize: 10, textDecoration: "none", color: "#fff", padding: "10px 11px" }}>About</a>
          <a href="#contact" style={{ fontSize: 10, textDecoration: "none", color: "#fff", padding: "10px 11px" }}>Contact</a>
        </nav>
        <CartLink storeSlug={slug} accent={FABTEX.orange} onAccent="#ffffff" ink="#ffffff" />
      </header>

      <CategoryNav slug={slug} categories={navCategories} accent={FABTEX.orange} ink="#fff" bg={FABTEX.dark} border="#343131" />

      {/* ---------- HERO ---------- */}
      <section style={{ height: 400, background: heroImage ? `url(${heroImage}) center/cover` : `linear-gradient(135deg, #3a332c, ${FABTEX.dark})`, position: "relative" }}>
        <div style={{ position: "absolute", left: "11%", top: 130, textShadow: "0 2px 6px #000", maxWidth: 520 }}>
          <h1 style={{ fontWeight: 400, letterSpacing: 3, fontSize: 28 }}>
            {store.business.description ? store.business.description.toUpperCase() : "EVERYTHING. RIGHT WHERE YOU NEED IT"}
          </h1>
          <a href="#catalog" style={{ display: "inline-block", marginTop: 14, background: FABTEX.orange, color: "#fff", fontWeight: 700, fontSize: 10, letterSpacing: 1, padding: "11px 18px", textDecoration: "none" }}>
            CHECK OUT OUR CATALOG NOW
          </a>
        </div>
      </section>

      {/* ---------- PROMO STRIP ---------- */}
      <div style={{ height: 48, background: "#080808", display: "flex", justifyContent: "center", alignItems: "center", gap: 20, fontSize: 11, letterSpacing: 1 }}>
        <span>NEW HERE? EXPLORE THE FULL CATALOG</span>
        <a href="#catalog" style={{ background: FABTEX.orange, color: "#fff", fontWeight: 700, fontSize: 10, padding: "10px 16px", textDecoration: "none" }}>VIEW CATALOG</a>
      </div>

      {/* ---------- FEATURED CATEGORIES ---------- */}
      {navCategories.length > 0 && (
        <section style={{ padding: "36px 11%", textAlign: "center" }}>
          <Reveal>
            <div style={{ display: "flex", gap: 10, justifyContent: "center", flexWrap: "wrap" }}>
              {navCategories.slice(0, 4).map((c) => (
                <a key={c.id} href={`/store/${slug}/category/${c.id}`} style={{ fontSize: 11, textDecoration: "none", color: "#fff", background: "rgba(255,255,255,0.06)", padding: "14px 30px" }}>
                  {c.name.toUpperCase()}
                </a>
              ))}
            </div>
            <a href={`/store/${slug}/catalog`} style={{ display: "inline-block", marginTop: 20, background: "transparent", border: "1px solid #777", color: "#fff", fontWeight: 700, fontSize: 10, padding: "11px 18px", textDecoration: "none" }}>
              VIEW ALL PRODUCTS
            </a>
          </Reveal>
        </section>
      )}

      {/* ---------- FEATURE BANNER ---------- */}
      <section id="catalog" style={{ minHeight: 300, background: `linear-gradient(135deg, #2a241f, ${FABTEX.dark})`, position: "relative", padding: "70px 12% 40px" }}>
        <Reveal>
          <div style={{ background: "rgba(15,15,15,0.94)", padding: 22, width: 300, marginBottom: 30 }}>
            <h2 style={{ fontSize: 13, lineHeight: 1.4, margin: "0 0 10px" }}>{store.name.toUpperCase()} SETS THE STANDARD FOR QUALITY.</h2>
            <p style={{ fontSize: 9, lineHeight: 1.6, color: "#aaa" }}>
              {store.business.description || "The corporate objective is to transform creative vision into performance-driven results at every opportunity."}
            </p>
          </div>

          {featured.length === 0 ? (
            <p style={{ opacity: 0.6, fontSize: 13 }}>No products published yet -- check back soon.</p>
          ) : (
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(220px, 1fr))", gap: 18 }}>
              {featured.map((p) => (
                <a key={p.id} href={`/store/${slug}/${p.kind}/${p.id}`} style={{ background: FABTEX.panel, border: "1px solid #393535", padding: 13, textDecoration: "none", color: "#fff", display: "block" }}>
                  <div style={{ height: 170, background: p.image ? `url(${p.image}) center/cover` : "linear-gradient(135deg,#76695e,#292321)" }} />
                  <h3 style={{ fontWeight: 400, fontSize: 14, margin: "10px 0 4px" }}>{p.name}</h3>
                  <p style={{ fontSize: 9, color: "#aaa", minHeight: 30 }}>{p.description || p.categoryName}</p>
                  <div style={{ color: FABTEX.orange, fontWeight: 700, marginBottom: 4 }}>{p.currency} {p.price.toLocaleString()}</div>
                </a>
              ))}
            </div>
          )}
        </Reveal>
      </section>

      {/* ---------- ABOUT / TESTIMONIALS ---------- */}
      <section id="about" style={{ display: "grid", gridTemplateColumns: "1.4fr 1fr", gap: 60, padding: "42px 11%" }}>
        <Reveal>
          <div>
            <h2 style={{ fontWeight: 400, letterSpacing: 2, fontSize: 22 }}>ABOUT US</h2>
            <p style={{ fontSize: 11, color: "#aaa", lineHeight: 1.7, maxWidth: 480 }}>
              {store.business.description || `${store.name} brings performance-driven quality to every project, backed by real customer reviews and ${completedOrders} completed orders.`}
            </p>
          </div>
        </Reveal>
        <Reveal>
          <div>
            <h2 style={{ fontWeight: 400, letterSpacing: 2, fontSize: 22 }}>WHAT CUSTOMERS SAY</h2>
            {avgRating && (
              <p style={{ color: FABTEX.orange, fontSize: 12, fontWeight: 700 }}>{"★".repeat(Math.round(avgRating))} {avgRating.toFixed(1)} average</p>
            )}
            {goodReviews.slice(0, 2).map((r) => (
              <div key={r.id} style={{ display: "flex", gap: 10, padding: "8px 0", borderBottom: "1px solid #333" }}>
                <div>
                  <p style={{ fontSize: 10, color: "#ccc", margin: 0 }}>&ldquo;{r.comment}&rdquo;</p>
                  <small style={{ fontSize: 9, color: "#777" }}>&mdash; {r.author.name || "Verified customer"}</small>
                </div>
              </div>
            ))}
          </div>
        </Reveal>
      </section>

      {/* ---------- FOOTER ---------- */}
      <footer id="contact" style={{ background: FABTEX.black, borderTop: "1px solid #333", padding: "38px 11%", display: "grid", gridTemplateColumns: "1.5fr 1fr 1fr", gap: 30 }}>
        <div>
          <div style={{ fontWeight: 700, fontSize: 16, letterSpacing: 3 }}>{store.name.toUpperCase()}</div>
          <p style={{ fontSize: 9, color: "#777", lineHeight: 1.6, marginTop: 8 }}>
            {store.business.description || "The performance partner for hospitality, healthcare and commercial interiors."}
          </p>
        </div>
        <div>
          <h4 style={{ fontSize: 10, marginBottom: 10 }}>CONTACT</h4>
          {store.contactEmail && <p style={{ fontSize: 9, color: "#aaa" }}>{store.contactEmail}</p>}
          {store.contactPhone && <p style={{ fontSize: 9, color: "#aaa" }}>{store.contactPhone}</p>}
        </div>
        <div>
          <h4 style={{ fontSize: 10, marginBottom: 10 }}>FOLLOW US</h4>
          {Object.entries(social).map(([k, v]) => (
            <a key={k} href={v} style={{ display: "block", textDecoration: "none", color: "#aaa", fontSize: 9, lineHeight: 1.9 }}>{k}</a>
          ))}
        </div>
      </footer>
      <div style={{ padding: "14px 11%", background: FABTEX.black, borderTop: "1px solid #222", color: "#666", fontSize: 8 }}>
        &copy; {new Date().getFullYear()} {store.name.toUpperCase()} STOREFRONT
      </div>
    </div>
  );
}
