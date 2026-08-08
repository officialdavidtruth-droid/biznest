import type React from "react";
import { CartLink } from "@/components/storefront/cart-link";
import { RRW } from "@/lib/template-themes";
import { subscribeToNewsletter } from "@/lib/actions/newsletter";
import { CategoryNav } from "@/components/storefront/category-nav";
import { Reveal } from "@/components/storefront/reveal";
import type { CategoryTreeNode } from "@/lib/storefront-categories";

// Ported from the rRW Premium Car Rental template (rrw_car_rental_nextjs.zip).
// Per its own README ("does not alter Prisma, auth, payments, or existing
// backend code" / "replace lib/mock-data.ts with your existing Prisma/API
// data layer" / "connect booking and checkout handlers to your existing
// backend"), this component reuses the template's dark hero, pill nav,
// category grid, fleet cards, and benefits strip, but is fed the same real
// store data (name, logo, banner, catalog, reviews, contact info) as the
// other templates. The original template hardcodes car-brand categories
// (Mercedes-Benz, Audi, BMW, Porsche) and a fixed "Tesla promotion" — those
// are replaced here with the store's own categories and its own top-priced
// rental item, since this integration doesn't fabricate store data. No
// payment integration is included — checkout continues through the
// existing flow.

type CatalogItem = {
  id: string; kind: "product" | "service"; name: string; description: string | null;
  price: number; currency: string; image: string | null; categoryName: string | null;
  type: string; rentalUnit: string | null; isBookable: boolean;
};
type Review = { id: string; rating: number; comment: string | null; author: { name: string | null } };

const wrap: React.CSSProperties = { padding: "32px 6%" };

export function RrwStorefront({
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
  const trending = catalogItems.slice(0, 4);
  const promoItem = [...catalogItems].sort((a, b) => b.price - a.price)[0];

  return (
    <div style={{ fontFamily: RRW.font, color: RRW.ink, background: "#fff", minHeight: "100vh" }}>
      {/* ---------- HERO ---------- */}
      <div
        style={{
          height: 390, position: "relative", overflow: "hidden",
          background: heroImage
            ? `linear-gradient(90deg, rgba(17,22,27,.55) 0%, rgba(17,22,27,.15) 60%), url(${heroImage}) center/cover`
            : `linear-gradient(135deg,#f6f7f8 0,#bdc5ca 45%,#11161b 78%)`,
        }}
      >
        <header
          style={{
            position: "absolute", left: "6%", right: "6%", top: 15, zIndex: 20, height: 45, background: "#fff",
            borderRadius: 25, display: "flex", alignItems: "center", padding: "0 18px", boxShadow: "0 4px 20px #00000012",
          }}
        >
          <a href={`/store/${slug}`} style={{ fontWeight: 900, fontSize: 20, letterSpacing: "-2px", textDecoration: "none", color: RRW.ink, display: "flex", alignItems: "center", gap: 8 }}>
            {store.logoUrl ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={store.logoUrl} alt={store.name} style={{ height: 26, width: 26, borderRadius: "50%", objectFit: "cover" }} />
            ) : null}
            {store.name}
          </a>
          <nav style={{ display: "flex", gap: 28, margin: "0 auto", fontSize: 10 }}>
            {catalogItems.length > 0 && <a href="#fleet" style={{ textDecoration: "none", color: RRW.ink }}>Fleet</a>}
            {navCategories.length > 0 && <a href={`/store/${slug}/catalog`} style={{ textDecoration: "none", color: RRW.ink }}>Categories</a>}
          </nav>
          <div style={{ display: "flex", gap: 10, alignItems: "center" }}>
            <CartLink storeSlug={slug} accent={RRW.accent} ink={RRW.ink} />
          </div>
        </header>

        <div style={{ position: "absolute", left: "6%", bottom: 65, color: "#fff", zIndex: 4, width: "48%" }}>
          <h1 style={{ fontSize: 39, lineHeight: 0.94, letterSpacing: "-2px", margin: 0 }}>{store.name}</h1>
          <p style={{ marginTop: 14, maxWidth: 380, fontSize: 12, lineHeight: 1.6 }}>
            {store.business.description || RRW.sub}
          </p>
          {catalogItems.length > 0 && (
            <a href="#fleet" style={{ display: "inline-block", marginTop: 16, background: RRW.accent, color: "#fff", border: 0, borderRadius: 18, padding: "10px 18px", fontWeight: 700, fontSize: 10, textDecoration: "none" }}>
              {RRW.cta}
            </a>
          )}
        </div>
      </div>

      <CategoryNav slug={slug} categories={navCategories} accent={RRW.accent} ink={RRW.ink} bg="#fff" border="#ddd" />

      {/* ---------- CATEGORY GRID ---------- */}
      {navCategories.length > 0 && (
        <section style={wrap}>
          <h2 style={{ fontSize: 30, margin: "0 0 25px", letterSpacing: "-1px" }}>Browse by Category</h2>
          <div style={{ display: "grid", gridTemplateColumns: `repeat(${Math.min(navCategories.length, 4)}, 1fr)`, gap: 12 }}>
            {navCategories.slice(0, 4).map((c, i) => (
              <a
                key={c.id}
                href={`/store/${slug}/category/${c.id}`}
                style={{
                  height: 185, position: "relative", overflow: "hidden", padding: 14,
                  background: [RRW.cat0, RRW.cat1, RRW.cat2, RRW.cat3][i % 4],
                  color: i === 2 ? "#fff" : RRW.ink, display: "block", textDecoration: "none",
                }}
              >
                <b style={{ position: "relative", zIndex: 2, fontSize: 17 }}>{c.name}</b>
                <span style={{ position: "absolute", zIndex: 3, right: 10, bottom: 10, width: 22, height: 22, background: "#fff", color: "#111", borderRadius: "50%", display: "grid", placeItems: "center" }}>↗</span>
              </a>
            ))}
          </div>
        </section>
      )}

      {/* ---------- TRENDING FLEET ---------- */}
      {trending.length > 0 && (
        <section id="fleet" style={{ background: "#f4f5f6", padding: "35px 6%" }}>
          <h2 style={{ fontSize: 30, margin: "0 0 25px", letterSpacing: "-1px" }}>Trending in the Fleet</h2>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", border: "1px solid #ddd" }}>
            {trending.map((item, i) => (
              <Reveal key={`${item.kind}-${item.id}`} delayMs={i * 40}>
                <a href={`/store/${slug}/${item.kind === "product" ? "product" : "service"}/${item.id}`} style={{ background: "#fff", borderRight: "1px solid #ddd", overflow: "hidden", display: "block", textDecoration: "none", color: RRW.ink }}>
                  <div style={{ height: 145, background: "#fff", position: "relative" }}>
                    {item.image ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={item.image} alt={item.name} style={{ width: "100%", height: "100%", objectFit: "contain" }} />
                    ) : null}
                    {item.categoryName && <span style={{ position: "absolute", top: 8, left: 8, background: "#fff", borderRadius: 4, padding: "4px 6px", fontSize: 7 }}>{item.categoryName}</span>}
                  </div>
                  <div style={{ padding: 10 }}>
                    <h3 style={{ fontSize: 12, margin: 0 }}>{item.name}</h3>
                    {item.rentalUnit && <p style={{ fontSize: 8, color: "#777" }}>Per {item.rentalUnit}</p>}
                    <strong style={{ fontSize: 9 }}>{item.currency} {item.price.toLocaleString()}</strong>
                  </div>
                </a>
              </Reveal>
            ))}
          </div>
        </section>
      )}

      {/* ---------- BENEFITS ---------- */}
      <section style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", background: "#080a0d", color: "#fff", padding: "28px 6%", gap: 15 }}>
        {[["♧", "Seamless booking"], ["♢", "Premium privileges for regular customers"], ["⚙", "Change or cancel up to 72h"], ["№", "No hidden fees"]].map((x) => (
          <div key={x[1]} style={{ display: "flex", gap: 12, alignItems: "center", borderRight: "1px solid #292b2e", fontSize: 23 }}>
            {x[0]}<span style={{ fontSize: 8, color: "#ddd" }}>{x[1]}</span>
          </div>
        ))}
      </section>

      {/* ---------- PROMO — the store's own top item, not a fixed brand ---------- */}
      {promoItem && (
        <section style={{ height: 300, background: "linear-gradient(135deg,#292b30,#0c0d10)", color: "#fff", position: "relative", overflow: "hidden", padding: "35px 6%", display: "flex" }}>
          <div>
            <h2 style={{ fontSize: 28, lineHeight: 1.05 }}>Featured:<br />{promoItem.name}</h2>
            <a href={`/store/${slug}/${promoItem.kind === "product" ? "product" : "service"}/${promoItem.id}`} style={{ display: "inline-block", marginTop: 12, background: RRW.accent, color: "#fff", border: 0, borderRadius: 18, padding: "10px 18px", fontWeight: 700, fontSize: 10, textDecoration: "none" }}>
              View Details
            </a>
          </div>
          {promoItem.image && (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={promoItem.image} alt={promoItem.name} style={{ position: "absolute", right: "10%", bottom: -20, width: "45%", height: 240, objectFit: "contain" }} />
          )}
        </section>
      )}

      {/* ---------- REVIEWS ---------- */}
      {goodReviews.length > 0 && (
        <section style={wrap}>
          <h2 style={{ fontSize: 30, margin: "0 0 25px", letterSpacing: "-1px" }}>What Customers Say</h2>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 12 }}>
            {goodReviews.slice(0, 3).map((r) => (
              <div key={r.id} style={{ background: "#f4f5f6", padding: 20 }}>
                <strong style={{ fontSize: 14, color: "#79a7ff" }}>{"★".repeat(r.rating)}</strong>
                <p style={{ fontSize: 10, color: "#666", lineHeight: 1.6, marginTop: 8 }}>{r.comment}</p>
                <small style={{ display: "block", marginTop: 8, fontWeight: 700 }}>{r.author.name ?? "Verified customer"}</small>
              </div>
            ))}
          </div>
        </section>
      )}

      {/* ---------- STATS ---------- */}
      {(catalogItems.length > 0 || completedOrders > 0 || avgRating != null) && (
        <section style={{ ...wrap, display: "flex", gap: 40, flexWrap: "wrap" }}>
          {catalogItems.length > 0 && <div><strong style={{ fontSize: 26, display: "block" }}>{catalogItems.length}+</strong><span style={{ fontSize: 10, color: "#777" }}>Vehicles/items listed</span></div>}
          {completedOrders > 0 && <div><strong style={{ fontSize: 26, display: "block" }}>{completedOrders}+</strong><span style={{ fontSize: 10, color: "#777" }}>Bookings completed</span></div>}
          {avgRating != null && <div><strong style={{ fontSize: 26, display: "block" }}>{avgRating.toFixed(1)}/5</strong><span style={{ fontSize: 10, color: "#777" }}>Average rating</span></div>}
        </section>
      )}

      {/* ---------- FOOTER ---------- */}
      <footer style={{ padding: "32px 6% 10px", display: "grid", gridTemplateColumns: "1.5fr 1fr 1fr 1fr", gap: 30, fontSize: 8, color: "#666" }}>
        <div>
          <h4 style={{ margin: "0 0 12px", color: "#111" }}>{store.name}</h4>
          <p>{store.business.description || "Premium rental, made simple."}</p>
          <form action={subscribeToNewsletter} style={{ display: "flex", border: "1px solid #ddd", borderRadius: 18, overflow: "hidden", width: 160, marginTop: 10 }}>
            <input type="hidden" name="slug" value={slug} />
            <input name="email" type="email" required placeholder="Email" style={{ border: 0, padding: 8, outline: 0, width: 130, fontSize: 8 }} />
            <button type="submit" style={{ border: 0, background: "#111", color: "#fff", width: 30, cursor: "pointer" }}>→</button>
          </form>
        </div>
        <div>
          <h4 style={{ margin: "0 0 12px", color: "#111" }}>Links</h4>
          <a href={`/store/${slug}/catalog`} style={{ display: "block", margin: "8px 0" }}>Fleet</a>
          <a href={`/store/${slug}/cart`} style={{ display: "block", margin: "8px 0" }}>Cart</a>
        </div>
        <div>
          <h4 style={{ margin: "0 0 12px", color: "#111" }}>Contact</h4>
          {store.contactEmail && <a style={{ display: "block", margin: "8px 0" }}>{store.contactEmail}</a>}
          {store.contactPhone && <a style={{ display: "block", margin: "8px 0" }}>{store.contactPhone}</a>}
        </div>
        <div>
          <h4 style={{ margin: "0 0 12px", color: "#111" }}>Follow</h4>
          {Object.entries(social).map(([k, v]) => (
            <a key={k} href={v} style={{ display: "block", margin: "8px 0" }}>{k}</a>
          ))}
        </div>
        <div style={{ gridColumn: "1/-1", borderTop: "1px solid #eee", paddingTop: 12, color: "#999" }}>© {new Date().getFullYear()} {store.name}. All rights reserved.</div>
      </footer>
    </div>
  );
}
