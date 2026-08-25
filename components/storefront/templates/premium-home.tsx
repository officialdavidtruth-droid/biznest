import type React from "react";
import { TrustBadge } from "@/components/storefront/trust-badge";
import { TrustScorePanel } from "@/components/storefront/trust-score-panel";
import type { TrustScoreChecklist } from "@/lib/actions/trust-score";
import { PREMIUM, PREMIUM_THEME } from "@/lib/template-themes";
import { Reveal } from "@/components/storefront/reveal";
import type { CategoryTreeNode } from "@/lib/storefront-categories";
import { PremiumHeader, PremiumFooter, wrap } from "@/components/storefront/templates/premium-chrome";

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

export function PremiumStorefront({
  store, slug, catalogItems, navCategories, goodReviews, avgRating, completedOrders, trustScore, trustChecklist, social,
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
  trustChecklist?: TrustScoreChecklist | null;
  completedOrders: number;
  social: Record<string, string>;
}) {
  const heroImage = store.bannerUrl;
  const catalogCategories = Array.from(new Set(catalogItems.map((i) => i.categoryName).filter(Boolean))) as string[];
  const flashItems = catalogItems.slice(0, 6);
  const railTitles = ["Recommended for You", "Trending", "Best Sellers", "New Arrivals"];

  return (
    <div style={{ background: PREMIUM.bg, color: PREMIUM.ink, fontFamily: PREMIUM.font, fontSize: 13, minHeight: "100vh" }} className="storefront-root">
      <PremiumHeader store={store} slug={slug} navCategories={navCategories} />

      {/* ---------- HERO SHELL (category sidebar + hero + side promo) ---------- */}
      <section className="bn-2col" style={{ padding: "8px 5% 0", display: "grid", gridTemplateColumns: "150px 1fr 150px", gap: 10, "--bn-cols": "150px 1fr 150px" } as React.CSSProperties}>
        <aside style={{ background: "#fff", borderRadius: 8, overflow: "hidden", border: "1px solid #e0e5e8" }}>
          <b style={{ display: "block", background: "#1e2429", color: "#fff", padding: 10, fontSize: 11 }}>☰ Category</b>
          {navCategories.slice(0, 10).map((c) => (
            <a key={c.id} href={`/${slug}/category/${c.id}`} style={{ display: "flex", justifyContent: "space-between", padding: "6px 10px", fontSize: 10, textDecoration: "none", color: PREMIUM.ink }}>
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
            <a href={`/${slug}/catalog`} style={{ marginLeft: "auto", color: "#5d6870", fontSize: 10, textDecoration: "none" }}>See all</a>
          </div>
          <div className="bn-grid-2" style={{ display: "grid", gridTemplateColumns: `repeat(${Math.min(catalogCategories.length, 6)}, 1fr)`, gap: 7 }}>
            {catalogCategories.slice(0, 6).map((cat) => (
              <a key={cat} href={`/${slug}/catalog?category=${encodeURIComponent(cat)}`} style={{ height: 78, borderRadius: 8, position: "relative", overflow: "hidden", background: "#ddd", display: "block", textDecoration: "none" }}>
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
            <a href={`/${slug}/catalog`} style={{ marginLeft: "auto", color: "#5d6870", fontSize: 10, textDecoration: "none" }}>See all</a>
          </div>
          <div className="bn-grid-2" style={{ display: "grid", gridTemplateColumns: "repeat(6, 1fr)", gap: 7 }}>
            {flashItems.map((item, i) => (
              <Reveal key={`${item.kind}-${item.id}`} delayMs={i * 30}>
                <a href={`/${slug}/${item.kind === "product" ? "product" : "service"}/${item.id}`} style={{ background: "#fff", border: "1px solid #e2e7e9", borderRadius: 8, padding: 6, display: "block", textDecoration: "none", color: PREMIUM.ink }}>
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
              <a href={`/${slug}/catalog`} style={{ marginLeft: "auto", color: "#5d6870", fontSize: 10, textDecoration: "none" }}>See all</a>
            </div>
            <div className="bn-grid-2" style={{ display: "grid", gridTemplateColumns: "repeat(6, 1fr)", gap: 7 }}>
              {rail.map((item) => (
                <a key={`${title}-${item.kind}-${item.id}`} href={`/${slug}/${item.kind === "product" ? "product" : "service"}/${item.id}`} style={{ background: "#fff", border: "1px solid #e2e7e9", borderRadius: 8, padding: 6, display: "block", textDecoration: "none", color: PREMIUM.ink }}>
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
          <div className="bn-grid-2" style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 8 }}>
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
          {trustScore != null && <div><TrustBadge score={trustScore} /></div>}
          {trustChecklist && (
            <div style={{ marginTop: 8 }}>
              <TrustScorePanel checklist={trustChecklist} />
            </div>
          )}
        </section>
      )}

      <PremiumFooter store={store} slug={slug} social={social} />
    </div>
  );
}
