import type React from "react";
import { TrustBadge } from "@/components/storefront/trust-badge";
import { CartLink } from "@/components/storefront/cart-link";
import { JUICELIFE } from "@/lib/template-themes";
import { subscribeToNewsletter } from "@/lib/actions/newsletter";
import { CategoryNav } from "@/components/storefront/category-nav";
import { Reveal } from "@/components/storefront/reveal";
import type { CategoryTreeNode } from "@/lib/storefront-categories";

// Ported from the JuiceLife cold-pressed-juice template
// (juicelife-react-nestjs.zip): green/orange palette, split hero with a
// gradient "bottle art" panel, bestsellers grid, health-benefits strip,
// about band, newsletter CTA, footer. Real store products/categories,
// reviews and contact info replace the source template's four hardcoded
// juice flavors; its own NestJS backend, local cart-drawer state, and
// checkout stub (`fetch('${API}/orders')`) are not used -- add-to-cart
// and checkout go through this platform's own cart/checkout flow, same
// as every other template.

type CatalogItem = {
  id: string; kind: "product" | "service"; name: string; description: string | null;
  price: number; currency: string; image: string | null; categoryName: string | null;
  type: string; rentalUnit: string | null; isBookable: boolean;
};
type Review = { id: string; rating: number; comment: string | null; author: { name: string | null } };

// Kept in sync with juicelife-chrome.tsx.
const wrap: React.CSSProperties = { maxWidth: 1180, margin: "0 auto", padding: "0 6%" };

export function JuiceLifeStorefront({
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
  async function subscribeNewsletter(formData: FormData) {
    "use server";
    await subscribeToNewsletter(slug, formData);
  }
  const heroImage = store.bannerUrl;
  const bestsellers = catalogItems.slice(0, 4);
  const menu = catalogItems.slice(0, 8);

  return (
    <div style={{ background: "#ffffff", color: JUICELIFE.ink, fontFamily: JUICELIFE.font, minHeight: "100vh" }} className="storefront-root">
      {/* ---------- TOPBAR ---------- */}
      <div style={{ height: 30, background: JUICELIFE.greenDark, color: "#fff", fontSize: 11, ...wrap, display: "flex", alignItems: "center", justifyContent: "space-between" }}>
        <span>🍃 Free delivery on orders over $30</span>
        <span>{store.contactPhone ? `☎ ${store.contactPhone}` : ""} {store.contactEmail ? `  ✉ ${store.contactEmail}` : ""}</span>
      </div>

      {/* ---------- NAV ---------- */}
      <header style={{ height: 82, display: "flex", alignItems: "center", ...wrap, gap: 30, background: "#fff", position: "sticky", top: 0, zIndex: 20, borderBottom: "1px solid #edf1ea" }}>
        <a href={`/store/${slug}`} style={{ fontWeight: 800, fontSize: 22, color: JUICELIFE.green, lineHeight: 0.8, textDecoration: "none", display: "flex", alignItems: "center", gap: 8 }}>
          {store.logoUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={store.logoUrl} alt={store.name} style={{ height: 34, width: "auto", borderRadius: 6 }} />
          ) : (
            <span>🍃 {store.name}</span>
          )}
        </a>
        <nav style={{ display: "flex", gap: 24, margin: "0 auto", fontSize: 12 }}>
          <a href="#home" style={{ color: JUICELIFE.ink, textDecoration: "none" }}>Home</a>
          <a href="#shop" style={{ color: JUICELIFE.ink, textDecoration: "none" }}>Shop</a>
          <a href="#menu" style={{ color: JUICELIFE.ink, textDecoration: "none" }}>Menu</a>
          <a href="#about" style={{ color: JUICELIFE.ink, textDecoration: "none" }}>About</a>
          <a href="#benefits" style={{ color: JUICELIFE.ink, textDecoration: "none" }}>Benefits</a>
          <a href="#contact" style={{ color: JUICELIFE.ink, textDecoration: "none" }}>Contact</a>
        </nav>
        <CartLink storeSlug={slug} accent={JUICELIFE.green} onAccent="#ffffff" ink={JUICELIFE.ink} />
      </header>

      <CategoryNav slug={slug} categories={navCategories} accent={JUICELIFE.green} ink={JUICELIFE.ink} bg="#fff" border="#edf1ea" />

      {/* ---------- HERO ---------- */}
      <section id="home" style={{ minHeight: 480, display: "grid", gridTemplateColumns: "48% 52%" }}>
        <div style={{ padding: "70px 8% 50px 6%" }}>
          <div style={{ fontSize: 11, color: JUICELIFE.green, fontWeight: 700, letterSpacing: 0.6 }}>100% NATURAL &amp; FRESH 🍃</div>
          <h1 style={{ fontSize: 50, lineHeight: 1, margin: "15px 0" }}>
            Good juice.<br /><em style={{ fontFamily: "cursive", color: JUICELIFE.orange, fontWeight: 500, fontStyle: "normal" }}>Good life.</em>
          </h1>
          <p style={{ fontSize: 13, lineHeight: 1.7, color: JUICELIFE.muted, maxWidth: 380 }}>
            {store.business.description || "Made with real fruits and vegetables. No sugar added. Just pure goodness in every sip."}
          </p>
          <div style={{ display: "flex", gap: 14, margin: "25px 0" }}>
            <a href="#shop" style={{ borderRadius: 25, padding: "13px 24px", background: JUICELIFE.green, color: "#fff", fontWeight: 700, fontSize: 11, textDecoration: "none" }}>Shop now &rarr;</a>
            <a href="#menu" style={{ borderRadius: 25, padding: "13px 24px", background: "#fff", color: JUICELIFE.green, border: "1px solid #dbe5d7", fontWeight: 700, fontSize: 11, textDecoration: "none" }}>Explore menu</a>
          </div>
          <div style={{ display: "flex", gap: 20, marginTop: 28, fontSize: 15, color: "#64a43b" }}>
            <span>🌿 <b style={{ display: "block", color: "#273126", marginLeft: 22, fontSize: 10 }}>100% Natural</b></span>
            <span>🌿 <b style={{ display: "block", color: "#273126", marginLeft: 22, fontSize: 10 }}>Fresh & Healthy</b></span>
            <span>🚚 <b style={{ display: "block", color: "#273126", marginLeft: 22, fontSize: 10 }}>Fast Delivery</b></span>
          </div>
        </div>
        <div style={{ position: "relative", overflow: "hidden", background: heroImage ? `url(${heroImage}) center/cover` : "radial-gradient(circle at 70% 20%, #d5efc8, #91c96b 40%, #4f9d36 78%, #246f28)" }}>
          {!heroImage && (
            <div style={{ position: "absolute", left: "7%", top: 65, width: 105, height: 105, borderRadius: "50%", background: "#2e8b27", color: "#fff", display: "grid", placeItems: "center", textAlign: "center", fontWeight: 700, fontSize: 12 }}>
              Cold<br />Pressed
            </div>
          )}
        </div>
      </section>

      {/* ---------- BESTSELLERS ---------- */}
      <section id="shop" style={{ padding: "48px 6%", background: JUICELIFE.soft }}>
        <Reveal>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-end", marginBottom: 25, flexWrap: "wrap", gap: 12 }}>
            <div>
              <div style={{ fontSize: 11, color: JUICELIFE.green, fontWeight: 700 }}>HANDPICKED FOR YOU</div>
              <h2 style={{ fontSize: 27, margin: "5px 0" }}>Our bestsellers</h2>
            </div>
            <a href={`/store/${slug}/catalog`} style={{ borderRadius: 25, padding: "13px 24px", background: JUICELIFE.green, color: "#fff", fontWeight: 700, fontSize: 11, textDecoration: "none" }}>View all products &rarr;</a>
          </div>
          {bestsellers.length === 0 ? (
            <p style={{ opacity: 0.6, fontSize: 13 }}>No products published yet -- check back soon.</p>
          ) : (
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(200px, 1fr))", gap: 16 }}>
              {bestsellers.map((p) => (
                <a key={p.id} href={`/store/${slug}/${p.kind}/${p.id}`} style={{ background: "#fff", border: "1px solid #edf1eb", borderRadius: 12, padding: 16, textDecoration: "none", color: JUICELIFE.ink, display: "block", boxShadow: "0 5px 18px #233a2410" }}>
                  <div style={{ height: 160, borderRadius: 9, background: p.image ? `url(${p.image}) center/cover` : "#f7faf3" }} />
                  <h3 style={{ fontSize: 13, margin: "13px 0 6px" }}>{p.name}</h3>
                  <p style={{ fontSize: 9, color: "#777", height: 28, margin: 0 }}>{p.description || p.categoryName}</p>
                  <div style={{ display: "flex", justifyContent: "space-between", marginTop: 15, color: JUICELIFE.green, fontWeight: 700 }}>
                    <b>{p.currency} {p.price.toLocaleString()}</b>
                  </div>
                </a>
              ))}
            </div>
          )}

          <div id="benefits" style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(160px, 1fr))", gap: 20, marginTop: 32, textAlign: "center" }}>
            {[["🌿", "Detoxifies Body", "Cleanses your body naturally"], ["♡", "Boosts Immunity", "Strengthens your immune system"], ["⚡", "More Energy", "Keeps you active all day"], ["♡", "Healthy Heart", "Supports heart health and wellness"]].map(([icon, title, text]) => (
              <div key={title} style={{ fontSize: 28, color: "#64a43b" }}>
                {icon}
                <b style={{ display: "block", color: "#273126", fontSize: 11, marginTop: 6 }}>{title}</b>
                <small style={{ display: "block", color: "#777", fontSize: 9, marginTop: 5 }}>{text}</small>
              </div>
            ))}
          </div>
        </Reveal>
      </section>

      {/* ---------- ABOUT ---------- */}
      <section id="about" style={{ padding: "48px 6%" }}>
        <Reveal>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1.2fr", gap: 45, alignItems: "center" }}>
            <div>
              <div style={{ fontSize: 11, color: JUICELIFE.green, fontWeight: 700 }}>ABOUT US 🍃</div>
              <h2 style={{ fontSize: 30, margin: "8px 0" }}>We believe in<br /><em style={{ fontFamily: "cursive", color: JUICELIFE.orange, fontStyle: "normal" }}>nature&apos;s goodness</em></h2>
              <p style={{ fontSize: 11, lineHeight: 1.8, color: "#6d746d", maxWidth: 380 }}>
                {store.business.description || "We believe nature has everything we need to live a healthy life. Our juices are cold-pressed, preservative-free and made with love."}
              </p>
              {avgRating && (
                <p style={{ fontSize: 12, color: JUICELIFE.green, fontWeight: 700 }}>{"★".repeat(Math.round(avgRating))} {avgRating.toFixed(1)} average &middot; {completedOrders} orders completed</p>
              )}
              {trustScore != null && <TrustBadge score={trustScore} />}
            </div>
            <div style={{ height: 300, borderRadius: 14, background: "linear-gradient(135deg, #dcefcf, #71ad4e 55%, #234f24)" }} />
          </div>
        </Reveal>
      </section>

      {/* ---------- MENU ---------- */}
      <section id="menu" style={{ padding: "48px 6%", background: JUICELIFE.soft }}>
        <Reveal>
          <div style={{ marginBottom: 25 }}>
            <div style={{ fontSize: 11, color: JUICELIFE.green, fontWeight: 700 }}>FRESH EVERY DAY</div>
            <h2 style={{ fontSize: 27, margin: "5px 0" }}>Explore our menu</h2>
          </div>
          {menu.length === 0 ? (
            <p style={{ opacity: 0.6, fontSize: 13 }}>Menu items will appear here once published.</p>
          ) : (
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(200px, 1fr))", gap: 16 }}>
              {menu.map((p) => (
                <a key={p.id} href={`/store/${slug}/${p.kind}/${p.id}`} style={{ background: "#fff", border: "1px solid #edf1eb", borderRadius: 12, padding: 16, textDecoration: "none", color: JUICELIFE.ink, display: "block" }}>
                  <div style={{ height: 130, borderRadius: 9, background: p.image ? `url(${p.image}) center/cover` : "#f7faf3" }} />
                  <h3 style={{ fontSize: 12, margin: "10px 0 4px" }}>{p.name}</h3>
                  <b style={{ fontSize: 11, color: JUICELIFE.green }}>{p.currency} {p.price.toLocaleString()}</b>
                </a>
              ))}
            </div>
          )}
        </Reveal>
      </section>

      {/* ---------- TESTIMONIALS ---------- */}
      {goodReviews.length > 0 && (
        <section style={{ padding: "40px 6%" }}>
          <Reveal>
            <h2 style={{ fontSize: 22, marginBottom: 16 }}>What customers say</h2>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))", gap: 16 }}>
              {goodReviews.slice(0, 3).map((r) => (
                <div key={r.id} style={{ background: "#fff", border: "1px solid #edf1eb", borderRadius: 12, padding: 18 }}>
                  <p style={{ fontSize: 12, fontStyle: "italic", margin: "0 0 8px" }}>&ldquo;{r.comment}&rdquo;</p>
                  <small style={{ color: "#777" }}>&mdash; {r.author.name || "Verified customer"}</small>
                </div>
              ))}
            </div>
          </Reveal>
        </section>
      )}

      {/* ---------- NEWSLETTER ---------- */}
      <section style={{ background: JUICELIFE.greenDark, color: "#fff", padding: "25px 7%", display: "flex", alignItems: "center", gap: 25, flexWrap: "wrap" }}>
        <div style={{ flex: 1, minWidth: 220 }}>
          <h2 style={{ margin: "0 0 5px", fontSize: 22 }}>Join the <em style={{ fontFamily: "cursive", color: JUICELIFE.orange, fontStyle: "normal" }}>{store.name}</em> family</h2>
          <p style={{ margin: 0, fontSize: 10, color: "#c7ddc9" }}>Subscribe to get exclusive offers, health tips and updates.</p>
        </div>
        <form action={subscribeNewsletter} style={{ display: "flex", width: "min(100%, 420px)" }}>
          <input type="hidden" name="slug" value={slug} />
          <input type="email" name="email" required placeholder="Enter your email" style={{ flex: 1, border: 0, padding: "13px 16px", borderRadius: "22px 0 0 22px" }} />
          <button type="submit" style={{ border: 0, background: JUICELIFE.orange, color: "#fff", padding: "0 22px", borderRadius: "0 22px 22px 0", fontWeight: 700 }}>Subscribe</button>
        </form>
      </section>

      {/* ---------- FOOTER ---------- */}
      <footer id="contact" style={{ padding: "38px 7% 20px", display: "grid", gridTemplateColumns: "1.5fr 1fr 1fr", gap: 30, fontSize: 10, color: "#697169" }}>
        <div>
          <div style={{ fontWeight: 800, fontSize: 18, color: JUICELIFE.green, marginBottom: 10 }}>🍃 {store.name}</div>
          <p>{store.business.description || "Fresh. Healthy. Delicious. Every day."}</p>
        </div>
        <div>
          <h4 style={{ color: "#222", margin: "0 0 15px", fontSize: 11 }}>Contact us</h4>
          {store.contactPhone && <p style={{ margin: "7px 0" }}>☎ {store.contactPhone}</p>}
          {store.contactEmail && <p style={{ margin: "7px 0" }}>✉ {store.contactEmail}</p>}
        </div>
        <div>
          <h4 style={{ color: "#222", margin: "0 0 15px", fontSize: 11 }}>Follow us</h4>
          {Object.entries(social).map(([k, v]) => (
            <a key={k} href={v} style={{ display: "block", margin: "7px 0", color: "#697169" }}>{k}</a>
          ))}
        </div>
        <div style={{ gridColumn: "1 / -1", borderTop: "1px solid #e5e9e2", paddingTop: 15, textAlign: "center", fontSize: 9 }}>
          &copy; {new Date().getFullYear()} {store.name}. All rights reserved.
        </div>
      </footer>
    </div>
  );
}
