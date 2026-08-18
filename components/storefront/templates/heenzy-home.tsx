import { CartLink } from "@/components/storefront/cart-link";
import { TrustBadge } from "@/components/storefront/trust-badge";
import { TrustScorePanel } from "@/components/storefront/trust-score-panel";
import type { TrustScoreChecklist } from "@/lib/actions/trust-score";
import { HEENZY, HEENZY_THEME, type TemplateTheme } from "@/lib/template-themes";
import { subscribeToNewsletter } from "@/lib/actions/newsletter";
import { CategoryNav } from "@/components/storefront/category-nav";
import { Reveal } from "@/components/storefront/reveal";
import type { CategoryTreeNode } from "@/lib/storefront-categories";

// All images below (logo, banner, category thumb, product/service photos,
// promo art, review avatars) come straight from the store owner's own
// uploads (Store.logoUrl / Store.bannerUrl / Product.images / Service.images
// via the existing dashboard upload fields). Nothing here is hardcoded
// artwork — when a field is empty a plain placeholder block is shown
// instead, ready for the owner to fill in from Settings / Products / Services.
//
// Theming works differently here than in Nova: styles/heenzy-template.css
// already scopes its colors as CSS custom properties on `.hz-root`
// (--hz-black, --hz-yellow, etc.), so instead of rewriting ~130 className
// references to inline styles, `heenzyCssVars()` below overrides those
// custom properties inline wherever `.hz-root` appears, and the existing
// stylesheet re-themes itself through normal CSS cascade. Exported so
// heenzy-chrome.tsx's `.hz-root` element can apply the same override.
// `theme` defaults to HEENZY_THEME so callers that don't pass one render
// exactly as before.

export function heenzyCssVars(theme: TemplateTheme): React.CSSProperties {
  return {
    "--hz-black": theme.ink,
    "--hz-white": theme.bg,
    "--hz-offwhite": theme.card,
    "--hz-yellow": theme.accent,
    "--hz-gray": theme.muted ?? HEENZY.gray,
    "--hz-border": theme.border ?? "#e7e7e7",
    "--hz-radius": theme.radius,
  } as React.CSSProperties;
}

type CatalogItem = {
  id: string; kind: "product" | "service"; name: string; description: string | null;
  price: number; currency: string; image: string | null; categoryName: string | null;
  type: string; rentalUnit: string | null; isBookable: boolean;
};

type Review = { id: string; rating: number; comment: string | null; author: { name: string | null } };

export function HeenzyStorefront({
  store, slug, catalogItems, catalogCategories, navCategories, goodReviews, avgRating, completedOrders, trustScore, trustChecklist, social, theme = HEENZY_THEME,
}: {
  store: {
    name: string; logoUrl: string | null; bannerUrl: string | null;
    contactEmail: string | null; contactPhone: string | null;
    business: { description: string | null };
  };
  slug: string;
  catalogItems: CatalogItem[];
  catalogCategories: string[];
  navCategories: CategoryTreeNode[];
  goodReviews: Review[];
  avgRating: number | null;
  trustScore: number | null;
  trustChecklist?: TrustScoreChecklist | null;
  completedOrders: number;
  social: Record<string, string>;
  /** Which Heenzy variant to render (colors, type, corner radius). Defaults to the original streetwear theme. */
  theme?: TemplateTheme;
}) {
  const heroImage = store.bannerUrl;
  const featuredItems = catalogItems.slice(0, 8);

  return (
    <div className="hz-root storefront-root" style={heenzyCssVars(theme)}>
      <HeenzyNav store={store} slug={slug} hasCatalog={catalogItems.length > 0} theme={theme} />
      <CategoryNav slug={slug} categories={navCategories} accent="var(--hz-black)" ink="var(--hz-black)" bg="#fff" border="#e7e7e7" />

      <div className="hz-wrap hz-top-grid">
        {/* ---------- HERO ---------- */}
        <div className="hz-hero">
          {heroImage && <div className="hz-hero-bg" style={{ backgroundImage: `url(${heroImage})` }} />}
          <div className="hz-hero-overlay" />
          <div className="hz-hero-content">
            <h1 className="hz-hero-title">
              {store.name} <span className="hz-accent">Reimagined</span>
            </h1>
            <p className="hz-hero-sub">{store.business.description || theme.sub}</p>
            <div className="hz-pill-row">
              <button className="hz-pill active">Style</button>
              <button className="hz-pill">Comfort</button>
              <button className="hz-pill">Trendy</button>
            </div>
            {catalogItems.length > 0 && <a href="#catalog" className="hz-btn hz-btn-yellow">{theme.cta}</a>}
          </div>
          <div className="hz-social-proof">
            <div className="hz-avatars">
              {store.logoUrl && <img src={store.logoUrl} alt="" />}
            </div>
            {avgRating != null ? `${avgRating.toFixed(1)}★ · ${completedOrders}+ happy customers` : "New store"}
          </div>
        </div>

        {/* ---------- RIGHT RAIL ---------- */}
        <div className="hz-rail">
          <div className="hz-promo-card">
            {store.logoUrl && <img src={store.logoUrl} alt="" className="hz-promo-img" />}
            <div>
              <h3>Step Into <span className="hz-accent">Greatness</span></h3>
              <p>Discover pieces that move with your lifestyle.</p>
            </div>
            {catalogItems.length > 0 && <a href="#catalog" className="hz-btn hz-btn-light">Shop Now</a>}
          </div>

          {navCategories.length > 0 && (
            <div>
              <div className="hz-section-head"><h2>Shop By Categories</h2></div>
              <div className="hz-cat-row" style={{ gridTemplateColumns: "repeat(2,1fr)" }}>
                {navCategories.slice(0, 4).map((cat) => {
                  const sample = catalogItems.find((i) => i.categoryName === cat.name && i.image);
                  return (
                    <a key={cat.id} href={`/${slug}/category/${cat.id}`} className="hz-cat-card" style={{ textDecoration: "none", color: "inherit" }}>
                      <div className="hz-cat-thumb">
                        {sample?.image ? <img src={sample.image} alt={cat.name} /> : null}
                      </div>
                      <div className="hz-cat-name">{cat.name}</div>
                    </a>
                  );
                })}
              </div>
            </div>
          )}

          {catalogItems.length > 0 && (
            <div>
              <div className="hz-section-head"><h2>Trending Now</h2></div>
              {catalogItems.slice(0, 4).map((item) => (
                <div key={`${item.kind}-${item.id}`} className="hz-trend-row">
                  <div className="hz-trend-thumb">{item.image ? <img src={item.image} alt={item.name} /> : null}</div>
                  <div className="hz-trend-info">
                    <p className="hz-name">{item.name}</p>
                    {item.categoryName && <span className="hz-rating">{item.categoryName}</span>}
                  </div>
                  <div className="hz-trend-price">{item.currency} {item.price.toLocaleString()}</div>
                </div>
              ))}
            </div>
          )}

          {catalogItems.length > 0 && (
            <div className="hz-offer-strip">
              {heroImage && <img src={heroImage} alt="" />}
              <div className="hz-content">
                <div className="hz-eyebrow">Limited Time Offer</div>
                <h3>Up to 30% Off on Selected Items</h3>
                <a href="#catalog" className="hz-btn hz-btn-yellow">Shop Now</a>
              </div>
            </div>
          )}

          <div className="hz-trust-strip">
            <div className="hz-trust-item">🚚 Free Shipping</div>
            <div className="hz-trust-item">↩️ Easy Returns</div>
            <div className="hz-trust-item">🔒 Secure Checkout</div>
          </div>

          {goodReviews.length > 0 && (
            <div>
              <div className="hz-section-head"><h2>What Customers Say</h2></div>
              <div className="hz-testimonial">
                <span className="hz-quote-mark">&ldquo;</span>
                <p>{goodReviews[0].comment}</p>
                <div className="hz-testimonial-author">
                  <div className="hz-name">{goodReviews[0].author.name ?? "Verified buyer"}</div>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* ---------- LIFESTYLE ---------- */}
      {store.business.description && (
        <div className="hz-wrap">
          <div className="hz-lifestyle">
            <div className="hz-lifestyle-copy">
              <h2>Not Just Products —<br />A Lifestyle</h2>
              <p>{store.business.description}</p>
              {catalogItems.length > 0 && <a href="#catalog" className="hz-btn hz-btn-dark">Explore Collection</a>}
            </div>
            <div className="hz-lifestyle-grid">
              <div className="hz-tall">{heroImage ? <img src={heroImage} alt="" /> : <div style={{ background: "var(--hz-offwhite)", width: "100%", height: "100%" }} />}</div>
              <div className="hz-short">{store.logoUrl ? <img src={store.logoUrl} alt="" /> : <div style={{ background: "var(--hz-offwhite)", width: "100%", height: "100%" }} />}</div>
              <div className="hz-short">{catalogItems[0]?.image ? <img src={catalogItems[0].image} alt="" /> : <div style={{ background: "var(--hz-offwhite)", width: "100%", height: "100%" }} />}</div>
            </div>
          </div>
        </div>
      )}

      {/* ---------- STATS ---------- */}
      <div className="hz-wrap">
        <div className="hz-stats-bar">
          <div className="hz-stat"><div><div className="hz-stat-num">{completedOrders}+</div><div className="hz-stat-label">Happy Customers</div></div></div>
          <div className="hz-stat"><div><div className="hz-stat-num">{catalogItems.length}+</div><div className="hz-stat-label">Collection</div></div></div>
          {avgRating != null && (
            <div className="hz-stat"><div><div className="hz-stat-num">{avgRating.toFixed(1)}/5</div><div className="hz-stat-label">Satisfaction Rate</div></div></div>
          )}
          {trustScore != null && (
            <div className="hz-stat">
              <TrustBadge score={trustScore} />
              {trustChecklist && (
                <div style={{ marginTop: 8 }}>
                  <TrustScorePanel checklist={trustChecklist} />
                </div>
              )}
            </div>
          )}
        </div>
      </div>

      {/* ---------- BEST SELLERS — a teaser, not the full catalog ---------- */}
      {featuredItems.length > 0 && (
        <div className="hz-wrap" id="catalog">
          <Reveal>
            <div className="hz-section-head" style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
              <h2>Best Sellers</h2>
              <a href={`/${slug}/catalog`} style={{ fontSize: 13, fontWeight: 700, color: "var(--hz-black)", textDecoration: "underline" }}>View all →</a>
            </div>
          </Reveal>
          <div className="hz-catalog-grid">
            {featuredItems.map((item, i) => (
              <Reveal key={`${item.kind}-${item.id}`} delayMs={i * 60}>
                <HeenzyProductCard item={item} slug={slug} storeName={store.name} />
              </Reveal>
            ))}
          </div>
        </div>
      )}

      {/* ---------- NEWSLETTER ---------- */}
      <HeenzyNewsletter slug={slug} storeName={store.name} />

      {/* ---------- FOOTER ---------- */}
      <footer className="hz-footer">
        <div className="hz-wrap">
          <div className="hz-footer-grid">
            <div>
              <div className="hz-logo" style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 10 }}>
                {store.logoUrl ? <img src={store.logoUrl} alt={store.name} style={{ height: 26, width: 26, borderRadius: 6, objectFit: "cover" }} /> : null}
                {store.name}
              </div>
              {store.business.description && <p style={{ fontSize: 13, color: "var(--hz-gray)", lineHeight: 1.6, maxWidth: 240 }}>{store.business.description.slice(0, 130)}</p>}
            </div>
            <div>
              <h4>Shop</h4>
              <ul>
                {navCategories.slice(0, 4).map((c) => <li key={c.id}><a href={`/${slug}/category/${c.id}`}>{c.name}</a></li>)}
              </ul>
            </div>
            <div>
              <h4>Help</h4>
              <ul><li><a href={`/${slug}/cart`}>Cart</a></li><li><a href="#catalog">Shop</a></li></ul>
            </div>
            <div>
              <h4>Company</h4>
              <ul><li><a href="#">About Us</a></li></ul>
            </div>
            <div>
              <h4>Contact</h4>
              <ul>
                {store.contactEmail && <li><a href={`mailto:${store.contactEmail}`}>{store.contactEmail}</a></li>}
                {store.contactPhone && <li><a href={`tel:${store.contactPhone}`}>{store.contactPhone}</a></li>}
              </ul>
            </div>
          </div>
          <div className="hz-footer-bottom">
            <span>© {new Date().getFullYear()} {store.name}. All rights reserved.</span>
            <span>Powered by BizNest</span>
          </div>
        </div>
      </footer>
    </div>
  );
}

export function HeenzyNav({ store, slug, hasCatalog, theme = HEENZY_THEME }: { store: { name: string; logoUrl: string | null }; slug: string; hasCatalog: boolean; theme?: TemplateTheme }) {
  return (
    <nav className="hz-root" style={{ ...heenzyCssVars(theme), position: "sticky", top: 0, zIndex: 50, background: "rgba(255,255,255,.92)", backdropFilter: "blur(10px)", borderBottom: "1px solid #e7e7e7" }}>
      <div className="hz-wrap hz-nav">
        <a href={`/${slug}`} className="hz-logo" style={{ display: "flex", alignItems: "center", gap: 8, textDecoration: "none", color: "var(--hz-black)" }}>
          {store.logoUrl ? <img src={store.logoUrl} alt={store.name} /> : null}
          {store.name}
        </a>
        <ul className="hz-nav-links">
          <li><a href={`/${slug}`}>Home</a></li>
          {hasCatalog && <li><a href={`/${slug}/catalog`}>Shop</a></li>}
          {hasCatalog && <li><a href={`/${slug}/search`}>Search</a></li>}
        </ul>
        <div className="hz-nav-icons">
          <CartLink storeSlug={slug} accent="var(--hz-black)" ink="var(--hz-black)" />
        </div>
      </div>
    </nav>
  );
}

function HeenzyProductCard({ item, slug, storeName }: { item: CatalogItem; slug: string; storeName: string }) {
  const href = `/${slug}/${item.kind === "product" ? "product" : "service"}/${item.id}`;
  return (
    <a href={href} className="hz-product-card" style={{ display: "block", textDecoration: "none", color: "inherit" }}>
      <div className="hz-product-img-wrap">
        {item.image ? <img src={item.image} alt={item.name} /> : <span style={{ fontSize: 28, opacity: .4, display: "flex", height: "100%", alignItems: "center", justifyContent: "center" }}>{storeName.charAt(0)}</span>}
      </div>
      <p className="hz-product-name">{item.name}</p>
      <div className="hz-product-meta">
        <span className="hz-product-price">{item.currency} {item.price.toLocaleString()}</span>
      </div>
      <div style={{ marginTop: 10, fontSize: 12, fontWeight: 700, color: "var(--hz-black)", textDecoration: "underline" }}>
        {item.kind === "service" ? (item.isBookable ? "Book now →" : "View details →") : "View & buy →"}
      </div>
    </a>
  );
}

function HeenzyNewsletter({ slug, storeName }: { slug: string; storeName: string }) {
  async function subscribe(formData: FormData) {
    "use server";
    await subscribeToNewsletter(slug, formData);
  }
  return (
    <div className="hz-wrap" style={{ padding: "56px 24px" }}>
      <div style={{ background: "var(--hz-black)", borderRadius: 14, padding: "36px 40px", display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: 20, color: "#fff" }}>
        <div>
          <h3 style={{ fontSize: 20, fontWeight: 800, margin: "0 0 4px" }}>Stay in the Loop</h3>
          <p style={{ fontSize: 13, opacity: .7, margin: 0 }}>Get the latest drops, offers, and updates from {storeName}.</p>
        </div>
        <form action={subscribe} style={{ display: "flex", gap: 10 }}>
          <input name="email" type="email" required placeholder="Enter your email" style={{ padding: "12px 16px", borderRadius: 10, border: "none", minWidth: 220, fontSize: 13 }} />
          <button type="submit" className="hz-btn hz-btn-yellow">Subscribe</button>
        </form>
      </div>
    </div>
  );
}
