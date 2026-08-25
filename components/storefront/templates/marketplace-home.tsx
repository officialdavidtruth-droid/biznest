import type React from "react";
import { TrustBadge } from "@/components/storefront/trust-badge";
import { TrustScorePanel } from "@/components/storefront/trust-score-panel";
import type { TrustScoreChecklist } from "@/lib/actions/trust-score";
import { CartLink } from "@/components/storefront/cart-link";
import { AccountLink } from "@/components/storefront/account-link";
import { MARKETPLACE, MARKETPLACE_THEME } from "@/lib/template-themes";
import { subscribeToNewsletter } from "@/lib/actions/newsletter";
import { CategoryNav } from "@/components/storefront/category-nav";
import { Reveal } from "@/components/storefront/reveal";
import type { CategoryTreeNode } from "@/lib/storefront-categories";

// Ported from the Marketplace Next.js template (marketplace_nextjs_template.zip).
// Per its own INTEGRATION_NOTES.md ("Use app/page.jsx as the storefront
// visual starting point. Replace the demo product arrays with the host
// project's Prisma/API data layer rather than changing the database
// schema."), this component keeps the template's layout and design tokens
// (topline bar, blue search bar, category sidebar, service-icon strip,
// per-category product rows, shop-by-category grid, sponsored-partners
// strip, promo sidebar) but is fed the same real store data (name, logo,
// banner, catalog, reviews, contact info) as every other template. All
// imagery comes from the store owner's own uploads — the template's demo
// asset images (public/assets/*.jpg) are not used, and product/category
// data comes from the store's actual catalog instead of the template's
// hardcoded arrays.

type CatalogItem = {
  id: string; kind: "product" | "service"; name: string; description: string | null;
  price: number; currency: string; image: string | null; categoryName: string | null;
  type: string; rentalUnit: string | null; isBookable: boolean;
};
type Review = { id: string; rating: number; comment: string | null; author: { name: string | null } };

const wrap: React.CSSProperties = { width: "88%", maxWidth: 1120, margin: "0 auto" };
const sectionHead: React.CSSProperties = { display: "flex", alignItems: "center", borderBottom: `1px solid ${MARKETPLACE.border}`, margin: "8px 0", paddingBottom: 7 };
const sectionHeadTitle: React.CSSProperties = { fontSize: 15, margin: 0 };
const seeAll: React.CSSProperties = { marginLeft: "auto", fontSize: 10, color: "#777", textDecoration: "none" };

function ItemCard({ item, slug }: { item: CatalogItem; slug: string }) {
  return (
    <a
      href={`/${slug}/${item.kind === "product" ? "product" : "service"}/${item.id}`}
      style={{ border: `1px solid #e4e4e4`, minHeight: 170, padding: 8, position: "relative", background: "#fff", display: "block", textDecoration: "none", color: MARKETPLACE.ink }}
    >
      <div style={{ height: 95, background: "#f2f2f2", position: "relative", overflow: "hidden" }}>
        {item.image ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={item.image} alt={item.name} style={{ width: "100%", height: "100%", objectFit: "cover" }} />
        ) : null}
      </div>
      {item.categoryName && (
        <span style={{ position: "absolute", left: 6, top: 6, background: MARKETPLACE.orange, color: "#fff", borderRadius: "50%", fontSize: 8, padding: "5px 6px" }}>
          {item.categoryName.slice(0, 3)}
        </span>
      )}
      <h3 style={{ fontSize: 11, margin: "8px 0 5px", lineHeight: 1.3 }}>{item.name}</h3>
      {item.description && <p style={{ fontSize: 9, color: "#999", margin: "0 0 6px" }}>{item.description.slice(0, 60)}</p>}
      <strong style={{ fontSize: 12, color: MARKETPLACE.price, fontWeight: 700 }}>
        {item.currency} {item.price.toLocaleString()}
      </strong>
    </a>
  );
}

function CatalogRow({ title, items, slug }: { title: string; items: CatalogItem[]; slug: string }) {
  if (items.length === 0) return null;
  return (
    <section style={{ marginTop: 18 }}>
      <div style={sectionHead}>
        <h2 style={sectionHeadTitle}>{title}</h2>
        <a href={`/${slug}/catalog`} style={seeAll}>View all ›</a>
      </div>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(150px, 1fr))", gap: 8 }}>
        {items.map((item, i) => (
          <Reveal key={`${item.kind}-${item.id}`} delayMs={i * 30}>
            <ItemCard item={item} slug={slug} />
          </Reveal>
        ))}
      </div>
    </section>
  );
}

export function MarketplaceStorefront({
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
  async function subscribeNewsletter(formData: FormData) {
    "use server";
    await subscribeToNewsletter(slug, formData);
  }
  const heroImage = store.bannerUrl;
  const catalogCategories = Array.from(new Set(catalogItems.map((i) => i.categoryName).filter(Boolean))) as string[];

  // Group the real catalog by its real categories instead of the
  // template's hardcoded fashion/electronics/home/sports arrays.
  const rows: { title: string; items: CatalogItem[] }[] = catalogCategories.length
    ? catalogCategories.slice(0, 4).map((cat) => ({
        title: cat,
        items: catalogItems.filter((i) => i.categoryName === cat).slice(0, 10),
      }))
    : catalogItems.length
    ? [{ title: "Featured Products", items: catalogItems.slice(0, 10) }]
    : [];

  const mostViewed = catalogItems.slice(0, 3);
  const serviceIcons = [
    { label: "Shop Safely", icon: "🛒" },
    { label: "Refund Case", icon: "↻" },
    { label: "Cash & Service", icon: "🚚" },
    { label: "Big Promotion", icon: "$" },
    { label: "Marketplace", icon: "▦" },
    { label: "Gift Cards", icon: "🎁" },
    { label: "Buying Guide", icon: "◉" },
  ];

  return (
    <div style={{ fontFamily: MARKETPLACE.font, color: MARKETPLACE.ink, background: "#fff", fontSize: 12, minHeight: "100vh" }} className="storefront-root">
      {/* ---------- TOPLINE ---------- */}
      <div style={{ height: 28, background: "#fafafa", borderBottom: "1px solid #eee", display: "flex", alignItems: "center", justifyContent: "center", color: "#777", fontSize: 10 }}>
        Welcome to {store.name} — {store.business.description ? store.business.description.slice(0, 70) : "quality products, delivered."}
      </div>

      {/* ---------- HEADER ---------- */}
      <header style={{ height: 70, display: "flex", alignItems: "center", padding: "0 6%", gap: 28, borderBottom: "1px solid #ddd" }}>
        <a href={`/${slug}`} style={{ fontSize: 24, fontWeight: 700, letterSpacing: "-1px", color: "#111", textDecoration: "none", display: "flex", alignItems: "center", gap: 8 }}>
          {store.logoUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={store.logoUrl} alt={store.name} style={{ height: 32, width: 32, borderRadius: "50%", objectFit: "cover" }} />
          ) : null}
          {store.name}
        </a>
        <nav style={{ display: "flex", gap: 22, fontSize: 10 }}>
          {catalogItems.length > 0 && <a href="#catalog" style={{ color: "inherit" }}>SHOP</a>}
          {store.business.description && <a href="#about" style={{ color: "inherit" }}>ABOUT US</a>}
          {(store.contactEmail || store.contactPhone) && <a href="#contact" style={{ color: "inherit" }}>CONTACT US</a>}
        </nav>
        <div style={{ marginLeft: "auto", display: "flex", gap: 16, alignItems: "center", fontSize: 10, color: "#555" }}>
          <CartLink storeSlug={slug} accent={MARKETPLACE.blue} ink={MARKETPLACE.ink} />
          <AccountLink storeSlug={slug} ink={MARKETPLACE.ink} />
        </div>
      </header>

      {/* ---------- BLUE SEARCH BAR ---------- */}
      <div style={{ height: 34, background: MARKETPLACE.blue, display: "flex", padding: "0 6%", alignItems: "center", color: "#fff" }}>
        <a href={`/${slug}/catalog`} style={{ background: MARKETPLACE.orange, minWidth: 165, height: 34, display: "flex", alignItems: "center", padding: "0 14px", fontWeight: 700, fontSize: 10, color: "#fff", textDecoration: "none" }}>
          ☰&nbsp;&nbsp;ALL CATEGORIES
        </a>
        <form action={`/${slug}/search`} style={{ display: "flex", flex: 1, marginLeft: 10, maxWidth: 520 }}>
          <input name="q" style={{ height: 24, flex: 1, border: 0, padding: "0 10px", fontSize: 9 }} placeholder="Search products and categories" />
          <button type="submit" style={{ height: 24, width: 35, background: MARKETPLACE.orangeDark, border: 0, color: "#fff" }}>⌕</button>
        </form>
        <div style={{ display: "flex", gap: 22, marginLeft: 15, fontSize: 9 }}>
          {catalogCategories.slice(0, 4).map((c) => (
            <a key={c} href={`/${slug}/catalog?category=${encodeURIComponent(c)}`} style={{ color: "#fff" }}>{c}</a>
          ))}
        </div>
      </div>

      <CategoryNav slug={slug} categories={navCategories} accent={MARKETPLACE.blue} ink={MARKETPLACE.ink} bg="#fff" border={MARKETPLACE.border} />

      <div className="bn-2col" style={{ ...wrap, display: "grid", gridTemplateColumns: "165px 1fr 190px", gap: 10, paddingTop: 10, "--bn-cols": "165px 1fr 190px" } as React.CSSProperties}>
        {/* ---------- SIDEBAR ---------- */}
        <aside style={{ border: `1px solid ${MARKETPLACE.border}`, alignSelf: "start" }}>
          <div style={{ background: MARKETPLACE.orange, color: "#fff", padding: 9, fontWeight: 700, fontSize: 10 }}>ALL CATEGORIES</div>
          {navCategories.length > 0
            ? navCategories.slice(0, 14).map((c) => (
                <a key={c.id} href={`/${slug}/category/${c.id}`} style={{ display: "block", padding: "6px 10px", borderBottom: "1px solid #eee", fontSize: 9, color: "inherit" }}>
                  {c.name} ›
                </a>
              ))
            : (
                <a href={`/${slug}/catalog`} style={{ display: "block", padding: "6px 10px", borderBottom: "1px solid #eee", fontSize: 9, color: "inherit" }}>
                  Browse catalog ›
                </a>
              )}
        </aside>

        {/* ---------- MAIN ---------- */}
        <main style={{ minWidth: 0 }}>
          {/* HERO */}
          <section
            style={{
              height: 250, position: "relative", overflow: "hidden", color: "#222",
              background: heroImage
                ? `linear-gradient(100deg, rgba(255,255,255,.85) 0%, rgba(255,255,255,.4) 45%, rgba(255,255,255,0) 70%), url(${heroImage}) center/cover`
                : `linear-gradient(100deg,#eef3f6 0%,#dfe9ee 100%)`,
            }}
          >
            <div style={{ position: "absolute", left: "8%", top: "28%", maxWidth: 320 }}>
              <h1 style={{ fontSize: 27, lineHeight: 1.1, margin: "0 0 8px" }}>{store.name}</h1>
              <p style={{ fontSize: 10, maxWidth: 260 }}>{store.business.description || MARKETPLACE_THEME.sub}</p>
              {catalogItems.length > 0 && (
                <a href="#catalog" style={{ display: "inline-block", background: "#111", color: "#fff", border: 0, padding: "8px 20px", fontSize: 9, marginTop: 8, textDecoration: "none" }}>
                  Shop Now
                </a>
              )}
            </div>
          </section>

          {/* SERVICE ICON STRIP */}
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(80px, 1fr))", gap: 10, padding: "15px 5px" }}>
            {serviceIcons.map((s, i) => (
              <div key={s.label} style={{ textAlign: "center" }}>
                <span style={{ width: 30, height: 30, borderRadius: "50%", display: "grid", placeItems: "center", color: "#fff", margin: "auto auto 5px", fontWeight: 700, background: ["#1e9ad6", "#e9505f", "#e8a51b", "#37a957", "#8c45a6", "#20a4b4", "#4d9b76"][i % 7] }}>
                  {s.icon}
                </span>
                <small style={{ fontSize: 8 }}>{s.label}</small>
              </div>
            ))}
          </div>

          {/* CATALOG ROWS (real store data, grouped by real categories) */}
          <div id="catalog">
            {rows.map((row) => (
              <CatalogRow key={row.title} title={row.title.toUpperCase()} items={row.items} slug={slug} />
            ))}
          </div>

          {/* SHOP BY CATEGORY GRID */}
          {catalogCategories.length > 0 && (
            <section style={{ marginTop: 18 }}>
              <div style={sectionHead}>
                <h2 style={sectionHeadTitle}>SHOP BY CATEGORIES</h2>
                <a href={`/${slug}/catalog`} style={seeAll}>View all ›</a>
              </div>
              <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(120px, 1fr))", gap: 7 }}>
                {catalogCategories.slice(0, 8).map((cat) => (
                  <a key={cat} href={`/${slug}/catalog?category=${encodeURIComponent(cat)}`} style={{ textAlign: "center", fontSize: 8, border: "1px solid #eee", paddingBottom: 7, textDecoration: "none", color: "inherit", display: "block" }}>
                    <div style={{ height: 85, background: "#eee" }} />
                    <span>{cat}</span>
                  </a>
                ))}
              </div>
            </section>
          )}

          {/* TESTIMONIALS AS "SPONSORED"-STYLE STRIP */}
          {goodReviews.length > 0 && (
            <section style={{ marginTop: 18 }}>
              <div style={sectionHead}>
                <h2 style={sectionHeadTitle}>WHAT CUSTOMERS SAY</h2>
              </div>
              <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(200px, 1fr))", gap: 8 }}>
                {goodReviews.slice(0, 4).map((r) => (
                  <div key={r.id} style={{ border: "1px solid #e4e4e4", padding: 10, fontSize: 9 }}>
                    <b style={{ color: MARKETPLACE.orange }}>{"★".repeat(r.rating)}</b>
                    <p style={{ margin: "6px 0" }}>{r.comment}</p>
                    <small style={{ color: "#999" }}>{r.author.name ?? "Verified customer"}</small>
                  </div>
                ))}
              </div>
            </section>
          )}

          {/* STATS AS "BRANDS" STRIP */}
          {(catalogItems.length > 0 || completedOrders > 0 || avgRating != null) && (
            <div style={{ height: 65, display: "flex", alignItems: "center", justifyContent: "space-around", borderTop: "1px solid #ddd", marginTop: 10, flexWrap: "wrap", gap: 8 }}>
              {catalogItems.length > 0 && <span style={{ fontSize: 11, color: "#666" }}><b>{catalogItems.length}+</b> in stock</span>}
              {completedOrders > 0 && <span style={{ fontSize: 11, color: "#666" }}><b>{completedOrders}+</b> orders completed</span>}
              {avgRating != null && <span style={{ fontSize: 11, color: "#666" }}><b>{avgRating.toFixed(1)}/5</b> average rating</span>}
              {trustScore != null && <TrustBadge score={trustScore} size="sm" />}
            </div>
          )}

          {trustChecklist && (
            <div style={{ marginTop: 12 }}>
              <TrustScorePanel checklist={trustChecklist} />
            </div>
          )}
        </main>

        {/* ---------- SIDE COLUMN ---------- */}
        <aside style={{ alignSelf: "start" }}>
          <div style={{ border: `1px solid ${MARKETPLACE.border}`, marginBottom: 10 }}>
            <h3 style={{ margin: 0, background: MARKETPLACE.blueDark, color: "#fff", padding: 7, fontSize: 9 }}>MOST VIEWED</h3>
            {mostViewed.length > 0
              ? mostViewed.map((item) => (
                  <a key={`${item.kind}-${item.id}`} href={`/${slug}/${item.kind === "product" ? "product" : "service"}/${item.id}`} style={{ display: "flex", justifyContent: "space-between", padding: 8, borderBottom: "1px solid #eee", fontSize: 8, textDecoration: "none", color: "inherit" }}>
                    {item.name}<b>{item.currency} {item.price.toLocaleString()}</b>
                  </a>
                ))
              : (
                  <div style={{ padding: 8, fontSize: 8, color: "#999" }}>No items yet.</div>
                )}
          </div>
          {(store.contactEmail || store.contactPhone || social.whatsapp) && (
            <div id="contact" style={{ border: `1px solid ${MARKETPLACE.border}`, padding: 10, fontSize: 9 }}>
              <h3 style={{ marginTop: 0, fontSize: 10 }}>Get in touch</h3>
              {social.whatsapp && <a href={`https://wa.me/${social.whatsapp}`} style={{ display: "block", margin: "4px 0", color: MARKETPLACE.blue }}>WhatsApp</a>}
              {store.contactPhone && <a href={`tel:${store.contactPhone}`} style={{ display: "block", margin: "4px 0", color: "inherit" }}>{store.contactPhone}</a>}
              {store.contactEmail && <a href={`mailto:${store.contactEmail}`} style={{ display: "block", margin: "4px 0", color: "inherit" }}>{store.contactEmail}</a>}
            </div>
          )}
        </aside>
      </div>

      {/* ---------- FOOTER ---------- */}
      <footer style={{ background: MARKETPLACE.footer, color: "#dce7ef", marginTop: 28, padding: "28px 6% 10px" }}>
        <div style={{ ...wrap, display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(160px, 1fr))", gap: 25 }}>
          <div>
            <h4 style={{ fontSize: 10, color: "#fff", margin: "0 0 10px" }}>{store.name}</h4>
            {store.business.description && <p style={{ fontSize: 9, margin: "6px 0" }}>{store.business.description}</p>}
          </div>
          <div>
            <h4 style={{ fontSize: 10, color: "#fff", margin: "0 0 10px" }}>Shop</h4>
            <a href={`/${slug}/catalog`} style={{ display: "block", fontSize: 8, margin: "6px 0", color: "inherit" }}>Full catalog</a>
            <a href={`/${slug}/cart`} style={{ display: "block", fontSize: 8, margin: "6px 0", color: "inherit" }}>Cart</a>
          </div>
          <div>
            <h4 style={{ fontSize: 10, color: "#fff", margin: "0 0 10px" }}>Contact</h4>
            {store.contactEmail && <a href={`mailto:${store.contactEmail}`} style={{ display: "block", fontSize: 8, margin: "6px 0", color: "inherit" }}>{store.contactEmail}</a>}
            {store.contactPhone && <a href={`tel:${store.contactPhone}`} style={{ display: "block", fontSize: 8, margin: "6px 0", color: "inherit" }}>{store.contactPhone}</a>}
            {Object.entries(social).map(([k, v]) => (
              <a key={k} href={v} style={{ display: "block", fontSize: 8, margin: "6px 0", color: "inherit" }}>{k}</a>
            ))}
          </div>
          <div>
            <h4 style={{ fontSize: 10, color: "#fff", margin: "0 0 10px" }}>Sign up for our newsletter</h4>
            <p style={{ fontSize: 8, margin: "0 0 8px" }}>Get product news and special offers.</p>
            <form action={subscribeNewsletter} style={{ display: "flex", flexDirection: "column", gap: 6 }}>
              <input type="hidden" name="slug" value={slug} />
              <input name="email" type="email" required placeholder="Your email address" style={{ border: "1px solid #6f93ae", background: "#234d70", padding: 8, color: "#fff", fontSize: 8 }} />
              <button type="submit" style={{ background: MARKETPLACE.orange, border: 0, color: "#fff", padding: "7px 12px", fontSize: 8, cursor: "pointer" }}>SUBSCRIBE</button>
            </form>
          </div>
        </div>
        <div style={{ ...wrap, borderTop: "1px solid #527592", marginTop: 18, paddingTop: 10, fontSize: 8, display: "flex", justifyContent: "space-between", flexWrap: "wrap", gap: 6 }}>
          <span>© {new Date().getFullYear()} {store.name}</span>
          <span>Terms &nbsp; Privacy Policy &nbsp; Legal Notice</span>
        </div>
      </footer>
    </div>
  );
}
