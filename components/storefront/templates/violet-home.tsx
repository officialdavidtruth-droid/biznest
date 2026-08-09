import type React from "react";
import { CartLink } from "@/components/storefront/cart-link";
import { VIOLET } from "@/lib/template-themes";
import { subscribeToNewsletter } from "@/lib/actions/newsletter";
import { CategoryNav } from "@/components/storefront/category-nav";
import { Reveal } from "@/components/storefront/reveal";
import type { CategoryTreeNode } from "@/lib/storefront-categories";

// Ported from the Violet store template (violet_store_template.zip). Per its
// own integration notes (integration/PRISMA_INTEGRATION.md) that template is
// UI-only, with product/category/cart/checkout data meant to be wired to the
// host app's own data layer instead of its mock-data.ts — so this component
// reuses Violet's layout and design tokens (purple/indigo palette, pill
// buttons, rounded product cards, dark footer) but is fed the same real
// store data (name, logo, banner, catalog, reviews, contact info) as the
// other templates. All imagery still comes from the store owner's own
// uploads — Violet's placeholder SVGs are not used.

type CatalogItem = {
  id: string; kind: "product" | "service"; name: string; description: string | null;
  price: number; currency: string; image: string | null; categoryName: string | null;
  type: string; rentalUnit: string | null; isBookable: boolean;
};
type Review = { id: string; rating: number; comment: string | null; author: { name: string | null } };

const wrap: React.CSSProperties = { width: "90%", maxWidth: 1200, margin: "0 auto" };

export function VioletStorefront({
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
  const featuredItems = catalogItems.slice(0, 4);

  return (
    <div style={{ background: VIOLET.bg, color: VIOLET.ink, fontFamily: VIOLET.font, minHeight: "100vh" }}>
      {/* ---------- TOPBAR ---------- */}
      <div style={{ background: VIOLET.navy, color: "#fff", textAlign: "center", padding: 9, fontSize: 12 }}>
        {store.contactPhone ? `Questions? Call ${store.contactPhone}` : `Welcome to ${store.name}`}
      </div>

      {/* ---------- NAV ---------- */}
      <header
        style={{
          height: 72, background: "#fff", borderBottom: "1px solid #eee", display: "flex",
          alignItems: "center", gap: 25, padding: "0 5%", position: "sticky", top: 0, zIndex: 20,
        }}
      >
        <a href={`/store/${slug}`} style={{ fontSize: 24, fontWeight: 900, textDecoration: "none", color: VIOLET.ink, display: "flex", alignItems: "center", gap: 10 }}>
          {store.logoUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={store.logoUrl} alt={store.name} style={{ height: 34, width: 34, borderRadius: "50%", objectFit: "cover" }} />
          ) : null}
          {store.name}
        </a>
        <div style={{ height: 44, borderRadius: 25, background: "#f4f4f7", color: "#888", display: "flex", alignItems: "center", padding: "0 15px", flex: 1, maxWidth: 520 }}>
          ⌕<span style={{ marginLeft: 8, fontSize: 13 }}>Search products, brands and categories</span>
        </div>
        <nav style={{ display: "flex", gap: 18, fontSize: 13, fontWeight: 700 }}>
          {catalogItems.length > 0 && <a href="#collection" style={{ textDecoration: "none", color: VIOLET.ink }}>Shop</a>}
          {navCategories.length > 0 && <a href={`/store/${slug}/catalog`} style={{ textDecoration: "none", color: VIOLET.ink }}>Categories</a>}
        </nav>
        <div style={{ display: "flex", gap: 15, alignItems: "center" }}>
          <CartLink storeSlug={slug} accent={VIOLET.accent} ink={VIOLET.ink} />
        </div>
      </header>

      <CategoryNav slug={slug} categories={navCategories} accent={VIOLET.accent} ink={VIOLET.ink} bg="#fff" border="#eee" />

      {/* ---------- HERO ---------- */}
      <section style={{ margin: "22px 5%" }}>
        <div
          style={{
            height: 360, borderRadius: 24, overflow: "hidden", position: "relative", color: "#fff",
            background: heroImage
              ? `linear-gradient(110deg, rgba(40,20,71,.88) 0%, rgba(116,66,238,.55) 58%, rgba(217,206,255,.25) 100%), url(${heroImage}) center/cover`
              : `linear-gradient(110deg,${VIOLET.navy},${VIOLET.accent} 58%,${VIOLET.lilac})`,
          }}
        >
          <div style={{ position: "absolute", zIndex: 2, left: "7%", top: "50%", transform: "translateY(-50%)", maxWidth: 480 }}>
            <span style={{ fontSize: 11, fontWeight: 900, letterSpacing: 2, opacity: 0.8 }}>{VIOLET.eyebrow}</span>
            <h1 style={{ fontSize: 48, lineHeight: 1, margin: "12px 0" }}>{store.name}</h1>
            <p style={{ fontSize: 15, lineHeight: 1.6, opacity: 0.9 }}>
              {store.business.description || VIOLET.sub}
            </p>
            {catalogItems.length > 0 && (
              <a href="#collection" style={{ display: "inline-block", marginTop: 16, background: "#fff", color: VIOLET.navy, border: 0, borderRadius: 25, padding: "13px 21px", fontWeight: 800, textDecoration: "none" }}>
                {VIOLET.cta} →
              </a>
            )}
          </div>
        </div>
      </section>

      {/* ---------- CATEGORY GRID ---------- */}
      {catalogCategories.length > 0 && (
        <section style={{ ...wrap, padding: "18px 0 28px" }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16 }}>
            <h2 style={{ fontSize: 22, margin: 0 }}>Shop by category</h2>
            <a href={`/store/${slug}/catalog`} style={{ fontSize: 13, color: VIOLET.accent, fontWeight: 800, textDecoration: "none" }}>See all</a>
          </div>
          <div style={{ display: "grid", gridTemplateColumns: `repeat(${Math.min(catalogCategories.length, 6)}, 1fr)`, gap: 14 }}>
            {catalogCategories.slice(0, 6).map((cat) => (
              <a key={cat} href={`/store/${slug}/catalog?category=${encodeURIComponent(cat)}`} style={{ background: "#fff", borderRadius: 17, padding: "17px 8px", textAlign: "center", boxShadow: "0 5px 20px #20144b0a", textDecoration: "none", color: VIOLET.ink }}>
                <b style={{ display: "block", fontSize: 13 }}>{cat}</b>
              </a>
            ))}
          </div>
        </section>
      )}

      {/* ---------- PRODUCT GRID ---------- */}
      {featuredItems.length > 0 && (
        <section id="collection" style={{ ...wrap, padding: "18px 0 28px" }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16 }}>
            <h2 style={{ fontSize: 22, margin: 0 }}>Trending now</h2>
            <a href={`/store/${slug}/catalog`} style={{ fontSize: 13, color: VIOLET.accent, fontWeight: 800, textDecoration: "none" }}>View all</a>
          </div>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 16 }}>
            {featuredItems.map((item, i) => (
              <Reveal key={`${item.kind}-${item.id}`} delayMs={i * 40}>
                <a href={`/store/${slug}/${item.kind === "product" ? "product" : "service"}/${item.id}`} style={{ background: "#fff", borderRadius: 18, overflow: "hidden", display: "block", textDecoration: "none", color: VIOLET.ink }}>
                  <div style={{ height: 235, background: "#eeeaf4", position: "relative" }}>
                    {item.image ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={item.image} alt={item.name} style={{ width: "100%", height: "100%", objectFit: "contain" }} />
                    ) : null}
                  </div>
                  <div style={{ padding: 14 }}>
                    {item.categoryName && <small style={{ fontSize: 9, color: "#999", textTransform: "uppercase", fontWeight: 900 }}>{item.categoryName}</small>}
                    <h3 style={{ fontSize: 14, margin: "6px 0" }}>{item.name}</h3>
                    <b style={{ fontSize: 15 }}>{item.currency} {item.price.toLocaleString()}</b>
                  </div>
                </a>
              </Reveal>
            ))}
          </div>
        </section>
      )}

      {/* ---------- TESTIMONIAL ---------- */}
      {goodReviews.length > 0 && goodReviews[0].comment && (
        <section style={{ background: "#fff", padding: "50px 0" }}>
          <Reveal style={{ ...wrap, maxWidth: 720, textAlign: "center", margin: "0 auto" }}>
            <div style={{ color: VIOLET.accent, fontSize: 18, letterSpacing: 3, marginBottom: 14 }}>{"★".repeat(goodReviews[0].rating)}</div>
            <p style={{ fontSize: 20, lineHeight: 1.5 }}>&ldquo;{goodReviews[0].comment}&rdquo;</p>
            <p style={{ marginTop: 16, fontSize: 12, fontWeight: 800, color: "#888" }}>{goodReviews[0].author.name ?? "Verified customer"}</p>
          </Reveal>
        </section>
      )}

      {/* ---------- STATS ---------- */}
      {(catalogItems.length > 0 || completedOrders > 0 || avgRating != null) && (
        <section style={{ ...wrap, padding: "36px 0", display: "flex", gap: 40, flexWrap: "wrap" }}>
          {catalogItems.length > 0 && <div><b style={{ fontSize: 26, display: "block", color: VIOLET.accent }}>{catalogItems.length}+</b><span style={{ fontSize: 12, color: "#777" }}>In the shop</span></div>}
          {completedOrders > 0 && <div><b style={{ fontSize: 26, display: "block", color: VIOLET.accent }}>{completedOrders}+</b><span style={{ fontSize: 12, color: "#777" }}>Orders completed</span></div>}
          {avgRating != null && <div><b style={{ fontSize: 26, display: "block", color: VIOLET.accent }}>{avgRating.toFixed(1)}/5</b><span style={{ fontSize: 12, color: "#777" }}>Average rating</span></div>}
        </section>
      )}

      {/* ---------- NEWSLETTER ---------- */}
      <section style={{ background: VIOLET.navy, color: "#fff", padding: "40px 5%" }}>
        <div style={{ ...wrap, textAlign: "center" }}>
          <h3 style={{ fontSize: 20, marginBottom: 8 }}>Stay in the loop</h3>
          <p style={{ fontSize: 13, opacity: 0.75, marginBottom: 18 }}>New arrivals and offers from {store.name}, straight to your inbox.</p>
          <form action={subscribeNewsletter} style={{ display: "flex", gap: 10, justifyContent: "center", flexWrap: "wrap" }}>
            <input type="hidden" name="slug" value={slug} />
            <input name="email" type="email" required placeholder="you@example.com" style={{ borderRadius: 25, border: 0, padding: "13px 18px", minWidth: 260, fontSize: 13 }} />
            <button type="submit" style={{ background: VIOLET.accent, color: "#fff", border: 0, borderRadius: 25, padding: "13px 21px", fontWeight: 800, cursor: "pointer" }}>Subscribe</button>
          </form>
        </div>
      </section>

      {/* ---------- FOOTER ---------- */}
      <footer style={{ background: VIOLET.navy, color: "#fff", padding: "42px 5%", display: "grid", gridTemplateColumns: "2fr 1fr 1fr", gap: 30 }}>
        <div>
          <b style={{ fontSize: 16 }}>{store.name}</b>
          <p style={{ color: "#aaa", fontSize: 12, margin: "9px 0" }}>{store.business.description || "Modern commerce storefront."}</p>
          {store.contactEmail && <p style={{ color: "#aaa", fontSize: 12, margin: "9px 0" }}>{store.contactEmail}</p>}
          {store.contactPhone && <p style={{ color: "#aaa", fontSize: 12, margin: "9px 0" }}>{store.contactPhone}</p>}
        </div>
        <div>
          <b style={{ fontSize: 16 }}>Shop</b>
          <a href={`/store/${slug}/catalog`} style={{ display: "block", color: "#aaa", fontSize: 12, margin: "9px 0", textDecoration: "none" }}>Catalog</a>
        </div>
        <div>
          <b style={{ fontSize: 16 }}>Support</b>
          <a href={`/store/${slug}/cart`} style={{ display: "block", color: "#aaa", fontSize: 12, margin: "9px 0", textDecoration: "none" }}>Cart</a>
          {Object.entries(social).map(([k, v]) => (
            <a key={k} href={v} style={{ display: "block", color: "#aaa", fontSize: 12, margin: "9px 0", textDecoration: "none" }}>{k}</a>
          ))}
        </div>
      </footer>
    </div>
  );
}
