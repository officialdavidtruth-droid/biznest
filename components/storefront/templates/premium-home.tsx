import type React from "react";
import { CartLink } from "@/components/storefront/cart-link";
import { PREMIUM, PREMIUM_THEME } from "@/lib/template-themes";
import { subscribeToNewsletter } from "@/lib/actions/newsletter";
import { CategoryNav } from "@/components/storefront/category-nav";
import { Reveal } from "@/components/storefront/reveal";
import type { CategoryTreeNode } from "@/lib/storefront-categories";

// Ported from the Premium Marketplace template (premium_marketplace_template.zip).
// Per its own README ("Replace lib/mock-data.ts with your existing
// Prisma/API data layer" / "payment screen is a UI placeholder — connect
// your existing payment integration"), this component reuses the template's
// layout and design tokens (category sidebar, dense enterprise nav, flash
// sale grid, brand/social-proof strip, dark footer) but is fed the same
// real store data (name, logo, banner, catalog, reviews, contact info) as
// the other templates. All imagery still comes from the store owner's own
// uploads — the template's placeholder SVGs are not used, and no payment
// integration is included (payments continue to run through the existing
// checkout flow).

type CatalogItem = {
  id: string; kind: "product" | "service"; name: string; description: string | null;
  price: number; currency: string; image: string | null; categoryName: string | null;
  type: string; rentalUnit: string | null; isBookable: boolean;
};
type Review = { id: string; rating: number; comment: string | null; author: { name: string | null } };

const wrap: React.CSSProperties = { width: "90%", maxWidth: 1200, margin: "0 auto" };

export function PremiumStorefront({
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
  const catalogCategories = Array.from(new Set(catalogItems.map((i) => i.categoryName).filter(Boolean))) as string[];
  const flashItems = catalogItems.slice(0, 6);
  const railTitles = ["Recommended for You", "Trending", "Best Sellers", "New Arrivals"];

  return (
    <div style={{ background: PREMIUM.bg, color: PREMIUM.ink, fontFamily: PREMIUM.font, fontSize: 13, minHeight: "100vh" }}>
      {/* ---------- TOPBAR ---------- */}
      <div style={{ height: 30, background: PREMIUM.topbar, display: "flex", justifyContent: "space-between", alignItems: "center", padding: "0 5%", fontSize: 10, color: "#5d6870" }}>
        <span>{store.business.description ? store.business.description.slice(0, 60) : store.name}</span>
        <span>{store.contactPhone || store.contactEmail || ""}</span>
      </div>

      {/* ---------- NAV ---------- */}
      <header style={{ height: 68, background: "#fff", borderBottom: "1px solid #e2e7e9", display: "flex", alignItems: "center", gap: 16, padding: "0 4.8%", position: "sticky", top: 0, zIndex: 20 }}>
        <a href={`/store/${slug}`} style={{ fontSize: 21, fontWeight: 900, minWidth: 175, textDecoration: "none", color: PREMIUM.ink, display: "flex", alignItems: "center", gap: 8 }}>
          {store.logoUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={store.logoUrl} alt={store.name} style={{ height: 32, width: 32, borderRadius: "50%", objectFit: "cover" }} />
          ) : null}
          {store.name}
        </a>
        <div style={{ height: 38, border: "1px solid #dfe4e7", borderRadius: 22, display: "flex", alignItems: "center", padding: "0 8px 0 12px", flex: 1, maxWidth: 430, color: "#8a949a" }}>
          ⌕<span style={{ marginLeft: 7, fontSize: 12 }}>Search the catalog…</span>
        </div>
        <nav style={{ display: "flex", gap: 15, fontSize: 11, fontWeight: 700 }}>
          {catalogItems.length > 0 && <a href="#flash" style={{ textDecoration: "none", color: PREMIUM.ink }}>Shop</a>}
          {navCategories.length > 0 && <a href={`/store/${slug}/catalog`} style={{ textDecoration: "none", color: PREMIUM.ink }}>Categories</a>}
        </nav>
        <div style={{ marginLeft: "auto", display: "flex", gap: 15, alignItems: "center" }}>
          <CartLink storeSlug={slug} accent={PREMIUM.accent} ink={PREMIUM.ink} />
        </div>
      </header>

      <CategoryNav slug={slug} categories={navCategories} accent={PREMIUM.accent} ink={PREMIUM.ink} bg="#fff" border="#e2e7e9" />

      {/* ---------- HERO SHELL (category sidebar + hero + side promo) ---------- */}
      <section style={{ padding: "8px 5% 0", display: "grid", gridTemplateColumns: "150px 1fr 150px", gap: 10 }}>
        <aside style={{ background: "#fff", borderRadius: 8, overflow: "hidden", border: "1px solid #e0e5e8" }}>
          <b style={{ display: "block", background: "#1e2429", color: "#fff", padding: 10, fontSize: 11 }}>☰ Category</b>
          {navCategories.slice(0, 10).map((c) => (
            <a key={c.id} href={`/store/${slug}/category/${c.id}`} style={{ display: "flex", justifyContent: "space-between", padding: "6px 10px", fontSize: 10, textDecoration: "none", color: PREMIUM.ink }}>
              {c.name}<span>›</span>
            </a>
          ))}
        </aside>

        <div
          style={{
            height: 184, borderRadius: 9, position: "relative", overflow: "hidden", color: "#fff",
            background: heroImage
              ? `linear-gradient(110deg, rgba(30,20,10,.75) 0%, rgba(110,74,58,.5) 55%, rgba(224,194,177,.2) 100%), url(${heroImage}) center/cover`
              : `linear-gradient(110deg,${PREMIUM.hero1},${PREMIUM.hero2} 55%,${PREMIUM.hero3})`,
          }}
        >
          <div style={{ position: "absolute", left: 25, top: 30, zIndex: 2, maxWidth: 300 }}>
            <small style={{ fontSize: 10, letterSpacing: 1, opacity: 0.85 }}>{PREMIUM_THEME.eyebrow}</small>
            <h1 style={{ fontSize: 22, lineHeight: 1.1, margin: "7px 0" }}>{store.name}</h1>
            <p style={{ fontSize: 10, maxWidth: 260 }}>{store.business.description || PREMIUM_THEME.sub}</p>
            {catalogItems.length > 0 && (
              <div style={{ marginTop: 10 }}>
                <a href="#flash" style={{ display: "inline-block", background: "#fff", color: "#5d4033", borderRadius: 18, padding: "8px 13px", fontWeight: 800, textDecoration: "none", fontSize: 11 }}>
                  {PREMIUM_THEME.cta}
                </a>
              </div>
            )}
          </div>
        </div>

        <div style={{ height: 184, borderRadius: 9, padding: 15, background: `linear-gradient(145deg,${PREMIUM.side1},${PREMIUM.side2})`, color: "#fff" }}>
          <small style={{ fontSize: 10, opacity: 0.85 }}>FEATURED</small>
          {avgRating != null ? (
            <h3 style={{ fontSize: 13, marginTop: 45 }}>{avgRating.toFixed(1)} / 5 — {goodReviews.length}+ reviews</h3>
          ) : (
            <h3 style={{ fontSize: 13, marginTop: 45 }}>{store.name}</h3>
          )}
        </div>
      </section>

      {/* ---------- SERVICE STRIP ---------- */}
      <div style={{ ...wrap, display: "flex", gap: 10, padding: "12px 0", overflow: "auto" }}>
        {["Free Shipping", "Secure Payment", "Easy Returns", "24/7 Support"].map((x) => (
          <span key={x} style={{ background: "#fff", whiteSpace: "nowrap", borderRadius: 20, padding: "9px 16px", boxShadow: "0 2px 8px #12232b0b", fontSize: 10 }}>◈ {x}</span>
        ))}
      </div>

      {/* ---------- FEATURED CATEGORY GRID ---------- */}
      {catalogCategories.length > 0 && (
        <section style={{ ...wrap, margin: "12px auto 20px" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 8 }}>
            <h2 style={{ fontSize: 15, margin: 0 }}>Featured Categories</h2>
            <a href={`/store/${slug}/catalog`} style={{ marginLeft: "auto", color: "#5d6870", fontSize: 10, textDecoration: "none" }}>See all</a>
          </div>
          <div style={{ display: "grid", gridTemplateColumns: `repeat(${Math.min(catalogCategories.length, 6)}, 1fr)`, gap: 7 }}>
            {catalogCategories.slice(0, 6).map((cat) => (
              <a key={cat} href={`/store/${slug}/catalog?category=${encodeURIComponent(cat)}`} style={{ height: 78, borderRadius: 8, position: "relative", overflow: "hidden", background: "#ddd", display: "block", textDecoration: "none" }}>
                <b style={{ position: "absolute", left: 8, bottom: 7, color: "#fff", textShadow: "0 1px 3px #000", fontSize: 10 }}>{cat}</b>
              </a>
            ))}
          </div>
        </section>
      )}

      {/* ---------- FLASH SALES ---------- */}
      {flashItems.length > 0 && (
        <section id="flash" style={{ ...wrap, margin: "12px auto 20px" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 8 }}>
            <h2 style={{ fontSize: 15, margin: 0 }}>Featured Products</h2>
            <a href={`/store/${slug}/catalog`} style={{ marginLeft: "auto", color: "#5d6870", fontSize: 10, textDecoration: "none" }}>See all</a>
          </div>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(6, 1fr)", gap: 7 }}>
            {flashItems.map((item, i) => (
              <Reveal key={`${item.kind}-${item.id}`} delayMs={i * 30}>
                <a href={`/store/${slug}/${item.kind === "product" ? "product" : "service"}/${item.id}`} style={{ background: "#fff", border: "1px solid #e2e7e9", borderRadius: 8, padding: 6, display: "block", textDecoration: "none", color: PREMIUM.ink }}>
                  <div style={{ height: 100, background: "#f0f3f4", borderRadius: 5, position: "relative" }}>
                    {item.image ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={item.image} alt={item.name} style={{ width: "100%", height: "100%", objectFit: "contain" }} />
                    ) : null}
                  </div>
                  {item.categoryName && <small style={{ display: "block", color: "#7d878d", fontSize: 8, marginTop: 5 }}>{item.categoryName}</small>}
                  <h3 style={{ fontSize: 9, margin: "4px 0", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{item.name}</h3>
                  <div style={{ fontSize: 10, fontWeight: 900, marginTop: 3 }}>{item.currency} {item.price.toLocaleString()}</div>
                </a>
              </Reveal>
            ))}
          </div>
        </section>
      )}

      {/* ---------- RAILS (reuse the catalog, no fabricated data) ---------- */}
      {catalogItems.length > 6 && railTitles.map((title, i) => {
        const rail = catalogItems.slice((i * 2) % catalogItems.length).slice(0, 6);
        if (rail.length === 0) return null;
        return (
          <section key={title} style={{ ...wrap, margin: "12px auto 20px" }}>
            <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 8 }}>
              <h2 style={{ fontSize: 15, margin: 0 }}>{title}</h2>
              <a href={`/store/${slug}/catalog`} style={{ marginLeft: "auto", color: "#5d6870", fontSize: 10, textDecoration: "none" }}>See all</a>
            </div>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(6, 1fr)", gap: 7 }}>
              {rail.map((item) => (
                <a key={`${title}-${item.kind}-${item.id}`} href={`/store/${slug}/${item.kind === "product" ? "product" : "service"}/${item.id}`} style={{ background: "#fff", border: "1px solid #e2e7e9", borderRadius: 8, padding: 6, display: "block", textDecoration: "none", color: PREMIUM.ink }}>
                  <div style={{ height: 100, background: "#f0f3f4", borderRadius: 5, position: "relative" }}>
                    {item.image ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={item.image} alt={item.name} style={{ width: "100%", height: "100%", objectFit: "contain" }} />
                    ) : null}
                  </div>
                  <h3 style={{ fontSize: 9, margin: "4px 0", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{item.name}</h3>
                  <div style={{ fontSize: 10, fontWeight: 900, marginTop: 3 }}>{item.currency} {item.price.toLocaleString()}</div>
                </a>
              ))}
            </div>
          </section>
        );
      })}

      {/* ---------- SOCIAL PROOF ---------- */}
      {goodReviews.length > 0 && (
        <section style={{ ...wrap, margin: "12px auto 20px" }}>
          <div style={{ marginBottom: 8 }}>
            <h2 style={{ fontSize: 15, margin: 0 }}>Social Proof</h2>
          </div>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 8 }}>
            {goodReviews.slice(0, 4).map((r) => (
              <div key={r.id} style={{ background: "#fff", border: "1px solid #e2e7e9", borderRadius: 8, padding: 10, minHeight: 75, fontSize: 9 }}>
                <b style={{ color: "#d79600" }}>{"★".repeat(r.rating)}</b>
                <p>{r.comment}</p>
                <small style={{ color: "#758087" }}>{r.author.name ?? "Verified customer"}</small>
              </div>
            ))}
          </div>
        </section>
      )}

      {/* ---------- STATS ---------- */}
      {(catalogItems.length > 0 || completedOrders > 0 || avgRating != null) && (
        <section style={{ ...wrap, margin: "12px auto 20px", display: "flex", gap: 30, flexWrap: "wrap" }}>
          {catalogItems.length > 0 && <div><b style={{ fontSize: 20, display: "block", color: PREMIUM.accent }}>{catalogItems.length}+</b><span style={{ fontSize: 10, color: "#5d6870" }}>In the shop</span></div>}
          {completedOrders > 0 && <div><b style={{ fontSize: 20, display: "block", color: PREMIUM.accent }}>{completedOrders}+</b><span style={{ fontSize: 10, color: "#5d6870" }}>Orders completed</span></div>}
          {avgRating != null && <div><b style={{ fontSize: 20, display: "block", color: PREMIUM.accent }}>{avgRating.toFixed(1)}/5</b><span style={{ fontSize: 10, color: "#5d6870" }}>Average rating</span></div>}
        </section>
      )}

      {/* ---------- NEWSLETTER ---------- */}
      <section style={{ background: "#1e2429", color: "#fff", padding: "30px 5%" }}>
        <div style={{ ...wrap, textAlign: "center" }}>
          <h3 style={{ fontSize: 16, marginBottom: 6 }}>Stay in the loop</h3>
          <p style={{ fontSize: 11, opacity: 0.75, marginBottom: 14 }}>New arrivals and offers from {store.name}, straight to your inbox.</p>
          <form action={subscribeNewsletter} style={{ display: "flex", gap: 8, justifyContent: "center", flexWrap: "wrap" }}>
            <input type="hidden" name="slug" value={slug} />
            <input name="email" type="email" required placeholder="you@example.com" style={{ borderRadius: 20, border: 0, padding: "10px 16px", minWidth: 240, fontSize: 12 }} />
            <button type="submit" style={{ background: PREMIUM.accent, color: "#fff", border: 0, borderRadius: 20, padding: "10px 16px", fontWeight: 800, cursor: "pointer", fontSize: 12 }}>Subscribe</button>
          </form>
        </div>
      </section>

      {/* ---------- FOOTER ---------- */}
      <footer style={{ background: "#fff", borderTop: "1px solid #dfe5e8", padding: "30px 5%", display: "grid", gridTemplateColumns: "2fr 1fr 1fr", gap: 20 }}>
        <div>
          <b style={{ fontSize: 12 }}>{store.name}</b>
          <p style={{ color: "#6e7980", fontSize: 10, margin: "6px 0" }}>{store.business.description || "Enterprise commerce made simple."}</p>
          {store.contactEmail && <p style={{ color: "#6e7980", fontSize: 10, margin: "6px 0" }}>{store.contactEmail}</p>}
          {store.contactPhone && <p style={{ color: "#6e7980", fontSize: 10, margin: "6px 0" }}>{store.contactPhone}</p>}
        </div>
        <div>
          <b style={{ fontSize: 12 }}>Shop</b>
          <a href={`/store/${slug}/catalog`} style={{ display: "block", color: "#6e7980", fontSize: 10, margin: "6px 0", textDecoration: "none" }}>Catalog</a>
        </div>
        <div>
          <b style={{ fontSize: 12 }}>Support</b>
          <a href={`/store/${slug}/cart`} style={{ display: "block", color: "#6e7980", fontSize: 10, margin: "6px 0", textDecoration: "none" }}>Cart</a>
          {Object.entries(social).map(([k, v]) => (
            <a key={k} href={v} style={{ display: "block", color: "#6e7980", fontSize: 10, margin: "6px 0", textDecoration: "none" }}>{k}</a>
          ))}
        </div>
      </footer>
    </div>
  );
}
