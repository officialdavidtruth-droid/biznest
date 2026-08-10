import type React from "react";
import { CartLink } from "@/components/storefront/cart-link";
import { RIVORA } from "@/lib/template-themes";
import { subscribeToNewsletter } from "@/lib/actions/newsletter";
import { CategoryNav } from "@/components/storefront/category-nav";
import { Reveal } from "@/components/storefront/reveal";
import type { CategoryTreeNode } from "@/lib/storefront-categories";

// Ported from the Rivora Fresh grocery template (rivora-fresh-react-nestjs.zip)
// -- exactly as requested: same deep-green/lime layout (topbar, sticky nav,
// split hero with trust strip, category grid, "farm" story band, product
// grid, newsletter, footer), but reading the store's own real
// products/categories/reviews/contact info instead of the source
// template's hardcoded product list, same as every other template on the
// platform. Its own standalone NestJS backend and cart-drawer state are
// not used -- adding to cart and checkout go through this platform's own
// cart/checkout flow (CartLink + product/service detail pages), the same
// as every other template here.

type CatalogItem = {
  id: string; kind: "product" | "service"; name: string; description: string | null;
  price: number; currency: string; image: string | null; categoryName: string | null;
  type: string; rentalUnit: string | null; isBookable: boolean;
};
type Review = { id: string; rating: number; comment: string | null; author: { name: string | null } };

// Kept in sync with the same constant in rivora-chrome.tsx — see the
// comment there for why maxWidth matters (uncapped width made the product
// page's square image balloon on wide screens).
const wrap: React.CSSProperties = { maxWidth: 1180, margin: "0 auto", padding: "0 5%" };
const RIVORA_BG = "#f7f9f6";

export function RivoraStorefront({
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
  const featuredProducts = catalogItems.slice(0, 6);

  return (
    <div style={{ background: RIVORA_BG, color: RIVORA.ink, fontFamily: RIVORA.font, minHeight: "100vh" }}>
      {/* ---------- TOPBAR ---------- */}
      <div style={{ height: 30, background: "#032718", color: "#dce8df", ...wrap, display: "flex", justifyContent: "space-between", alignItems: "center", fontSize: 10 }}>
        <span>Fresh picks, delivered fast</span>
        <span>{store.contactPhone ? `☎ ${store.contactPhone}` : ""} {store.contactEmail ? `  ✉ ${store.contactEmail}` : ""}</span>
      </div>

      {/* ---------- NAV ---------- */}
      <header style={{ height: 78, background: "#052d20", color: "#fff", ...wrap, display: "flex", alignItems: "center", gap: 28, position: "sticky", top: 0, zIndex: 30, borderBottom: "1px solid #164634" }}>
        <a href={`/store/${slug}`} style={{ display: "flex", alignItems: "center", gap: 8, color: "#fff", textDecoration: "none", minWidth: 180 }}>
          {store.logoUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={store.logoUrl} alt={store.name} style={{ height: 34, width: "auto", borderRadius: 6 }} />
          ) : (
            <b style={{ fontSize: 28, color: RIVORA.lime }}>{store.name.charAt(0).toUpperCase()}</b>
          )}
          <span style={{ fontWeight: 800, fontSize: 14 }}>{store.name}</span>
        </a>
        <nav style={{ display: "flex", gap: 22, flex: 1, justifyContent: "center", fontSize: 11 }}>
          <a href="#home" style={{ color: "#d8e2dc", textDecoration: "none" }}>Home</a>
          <a href="#shop" style={{ color: "#d8e2dc", textDecoration: "none" }}>Shop</a>
          <a href="#categories" style={{ color: "#d8e2dc", textDecoration: "none" }}>Categories</a>
          <a href="#about" style={{ color: "#d8e2dc", textDecoration: "none" }}>About</a>
          <a href="#contact" style={{ color: "#d8e2dc", textDecoration: "none" }}>Contact</a>
        </nav>
        <CartLink storeSlug={slug} accent={RIVORA.lime} onAccent="#153600" ink="#fff" />
      </header>

      <CategoryNav slug={slug} categories={navCategories} accent={RIVORA.lime} ink="#fff" bg="#052d20" border="#164634" />

      {/* ---------- HERO ---------- */}
      <section id="home" style={{ background: RIVORA.deep, color: "#fff", padding: "55px 5% 60px", display: "grid", gridTemplateColumns: "48% 52%", gap: 30, alignItems: "center" }}>
        <div>
          <label style={{ fontSize: 10, letterSpacing: 1.5, color: RIVORA.lime, fontWeight: 700 }}>FRESH &middot; NATURAL &middot; PREMIUM</label>
          <h1 style={{ fontSize: 46, lineHeight: 1.05, margin: "14px 0" }}>
            Fresh choices,<br /><em style={{ fontStyle: "normal", color: RIVORA.lime }}>better</em> life
          </h1>
          <p style={{ maxWidth: 390, color: "#b7c8bf", fontSize: 13, lineHeight: 1.6 }}>
            {store.business.description || "Premium quality fruits and vegetables, delivered fresh to your doorstep."}
          </p>
          <div style={{ display: "flex", gap: 12, margin: "24px 0" }}>
            <a href="#shop" style={{ background: RIVORA.lime, color: "#153600", borderRadius: 7, padding: "13px 20px", fontWeight: 700, fontSize: 11, textDecoration: "none" }}>Shop now &rarr;</a>
            <a href="#categories" style={{ background: "transparent", border: "1px solid #557164", color: "#fff", borderRadius: 7, padding: "13px 20px", fontWeight: 700, fontSize: 11, textDecoration: "none" }}>Explore categories</a>
          </div>
          {avgRating && (
            <div style={{ display: "flex", alignItems: "center", gap: 10, marginTop: 10 }}>
              <strong style={{ color: RIVORA.lime, fontSize: 13 }}>{"★".repeat(Math.round(avgRating))}</strong>
              <small style={{ fontSize: 9, color: "#aabcb3" }}>{avgRating.toFixed(1)} average rating &middot; {completedOrders} orders completed</small>
            </div>
          )}
        </div>
        <div style={{ position: "relative", minHeight: 220, display: "flex", alignItems: "center", justifyContent: "center", background: heroImage ? `url(${heroImage}) center/cover` : "transparent", borderRadius: 20 }}>
          {!heroImage && <div style={{ fontSize: 130 }}>🥑🥦🍏</div>}
        </div>
      </section>

      {/* ---------- CATEGORIES ---------- */}
      <section id="categories" style={{ padding: "36px 5%" }}>
        <Reveal>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 18 }}>
            <h2 style={{ fontSize: 19, margin: 0 }}>Shop by category</h2>
            <a href={`/store/${slug}/catalog`} style={{ color: "#5a9348", textDecoration: "none", fontSize: 10 }}>View all &rarr;</a>
          </div>
          {navCategories.length === 0 ? (
            <p style={{ opacity: 0.6, fontSize: 13 }}>Categories will appear here as products are added.</p>
          ) : (
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(150px, 1fr))", gap: 12 }}>
              {navCategories.slice(0, 6).map((c) => (
                <a key={c.id} href={`/store/${slug}/category/${c.id}`} style={{ background: "#fff", border: "1px solid #e5eae5", borderRadius: 11, padding: 10, textDecoration: "none", color: RIVORA.ink, boxShadow: "0 4px 16px #1526190a" }}>
                  <div style={{ height: 90, borderRadius: 8, background: "linear-gradient(135deg,#f3f7ef,#cfe7bc)" }} />
                  <h3 style={{ fontSize: 11, margin: "9px 0 2px" }}>{c.name}</h3>
                  <small style={{ fontSize: 9, color: "#78817b" }}>{c.count} items</small>
                </a>
              ))}
            </div>
          )}
        </Reveal>
      </section>

      {/* ---------- ABOUT / FARM STRIP ---------- */}
      <section id="about" style={{ padding: "0 5% 36px" }}>
        <Reveal>
          <div style={{ background: "#053623", borderRadius: 15, color: "#fff", padding: "30px 35px", display: "grid", gridTemplateColumns: "1.15fr .85fr", gap: 25, alignItems: "center" }}>
            <div>
              <label style={{ fontSize: 10, letterSpacing: 1.5, color: RIVORA.lime, fontWeight: 700 }}>WHY SHOP WITH US</label>
              <h2 style={{ fontSize: 26, lineHeight: 1.1, margin: "8px 0" }}>Fresh, natural,<br />delivered fast.</h2>
              <p style={{ fontSize: 11, lineHeight: 1.6, color: "#b0c2b8", maxWidth: 320 }}>
                {store.business.description || "We ensure the highest quality and freshness in every product we deliver."}
              </p>
            </div>
            <div style={{ background: "#073e2c", border: "1px solid #1b5943", borderRadius: 12, padding: 15 }}>
              {[["100% Natural", "Fresh, organic products"], ["Fast Delivery", "Straight to your door"], ["Secure Payment", "Protected checkout"]].map(([t, s]) => (
                <div key={t} style={{ display: "flex", flexDirection: "column", gap: 2, padding: "10px 0", borderBottom: "1px solid #1b5943" }}>
                  <strong style={{ fontSize: 13 }}>{t}</strong>
                  <small style={{ fontSize: 9, color: "#9db0a7" }}>{s}</small>
                </div>
              ))}
            </div>
          </div>
        </Reveal>
      </section>

      {/* ---------- PRODUCTS ---------- */}
      <section id="shop" style={{ padding: "36px 5%" }}>
        <Reveal>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 18 }}>
            <h2 style={{ fontSize: 19, margin: 0 }}>Best selling products</h2>
            <a href={`/store/${slug}/catalog`} style={{ color: "#5a9348", textDecoration: "none", fontSize: 10 }}>View all products &rarr;</a>
          </div>
          {featuredProducts.length === 0 ? (
            <p style={{ opacity: 0.6, fontSize: 13 }}>No products published yet -- check back soon.</p>
          ) : (
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(160px, 1fr))", gap: 12 }}>
              {featuredProducts.map((p) => (
                <a key={p.id} href={`/store/${slug}/${p.kind}/${p.id}`} style={{ background: "#fff", border: "1px solid #e4e9e4", borderRadius: 11, padding: 10, position: "relative", textDecoration: "none", color: RIVORA.ink, display: "block" }}>
                  {p.categoryName && (
                    <label style={{ position: "absolute", top: 10, left: 10, background: "#8bd632", color: "#173b09", borderRadius: 8, padding: "4px 7px", fontSize: 7, fontWeight: 700 }}>{p.categoryName}</label>
                  )}
                  <div style={{ height: 140, borderRadius: 8, background: p.image ? `url(${p.image}) center/cover` : "linear-gradient(145deg,#f5f8f1,#e4f0dc)" }} />
                  <h3 style={{ fontSize: 11, margin: "9px 0 3px" }}>{p.name}</h3>
                  <strong style={{ fontSize: 12 }}>{p.currency} {p.price.toLocaleString()}</strong>
                </a>
              ))}
            </div>
          )}
        </Reveal>
      </section>

      {/* ---------- TESTIMONIALS ---------- */}
      {goodReviews.length > 0 && (
        <section style={{ padding: "0 5% 36px" }}>
          <Reveal>
            <h2 style={{ fontSize: 19, marginBottom: 14 }}>What customers say</h2>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))", gap: 14 }}>
              {goodReviews.slice(0, 3).map((r) => (
                <div key={r.id} style={{ background: "#fff", border: "1px solid #e5eae5", borderRadius: 11, padding: 16 }}>
                  <p style={{ fontSize: 12, fontStyle: "italic", margin: "0 0 8px" }}>&ldquo;{r.comment}&rdquo;</p>
                  <small style={{ color: "#78817b" }}>&mdash; {r.author.name || "Verified customer"}</small>
                </div>
              ))}
            </div>
          </Reveal>
        </section>
      )}

      {/* ---------- NEWSLETTER ---------- */}
      <section style={{ margin: "0 5%", background: "#053623", color: "#fff", borderRadius: 14, padding: "24px 30px", display: "flex", alignItems: "center", justifyContent: "space-between", flexWrap: "wrap", gap: 16 }}>
        <div>
          <h2 style={{ margin: "0 0 4px", fontSize: 18 }}>Subscribe to our newsletter</h2>
          <p style={{ margin: 0, color: "#abc0b5", fontSize: 9 }}>Get the latest updates on new products and special offers.</p>
        </div>
        <form action={subscribeNewsletter} style={{ display: "flex", width: "min(100%, 380px)" }}>
          <input type="hidden" name="slug" value={slug} />
          <input type="email" name="email" required placeholder="Enter your email" style={{ flex: 1, border: "1px solid #245740", background: "#0b4531", color: "#fff", padding: 12, borderRadius: "7px 0 0 7px", fontSize: 11 }} />
          <button type="submit" style={{ width: 130, background: RIVORA.lime, color: "#173700", border: 0, borderRadius: "0 7px 7px 0", fontWeight: 700, fontSize: 11 }}>Subscribe</button>
        </form>
      </section>

      {/* ---------- FOOTER ---------- */}
      <footer id="contact" style={{ background: "#03281c", color: "#9db0a7", marginTop: 32, padding: "32px 5% 18px", display: "grid", gridTemplateColumns: "1.4fr 1fr 1fr", gap: 25, fontSize: 10 }}>
        <div>
          <div style={{ display: "flex", alignItems: "center", gap: 8, color: "#fff", fontWeight: 800, marginBottom: 8 }}>{store.name}</div>
          <p>{store.business.description || "Fresh choices for a healthier, better life."}</p>
        </div>
        <div>
          <h4 style={{ color: "#fff", margin: "0 0 10px", fontSize: 11 }}>Contact</h4>
          {store.contactEmail && <p style={{ margin: "6px 0" }}>{store.contactEmail}</p>}
          {store.contactPhone && <p style={{ margin: "6px 0" }}>{store.contactPhone}</p>}
        </div>
        <div>
          <h4 style={{ color: "#fff", margin: "0 0 10px", fontSize: 11 }}>Follow us</h4>
          {Object.entries(social).map(([k, v]) => (
            <a key={k} href={v} style={{ display: "block", color: "#9db0a7", margin: "6px 0", textDecoration: "none" }}>{k}</a>
          ))}
        </div>
        <div style={{ gridColumn: "1 / -1", borderTop: "1px solid #164331", paddingTop: 13, fontSize: 9 }}>
          &copy; {new Date().getFullYear()} {store.name}. All rights reserved.
        </div>
      </footer>
    </div>
  );
}
