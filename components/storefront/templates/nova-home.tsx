import type React from "react";
import { TrustBadge } from "@/components/storefront/trust-badge";
import { TrustScorePanel } from "@/components/storefront/trust-score-panel";
import type { TrustScoreChecklist } from "@/lib/actions/trust-score";
import { CartLink } from "@/components/storefront/cart-link";
import { AccountLink } from "@/components/storefront/account-link";
import { NOVA, NOVA_THEME, type TemplateTheme } from "@/lib/template-themes";
import { subscribeToNewsletter } from "@/lib/actions/newsletter";
import { CategoryNav } from "@/components/storefront/category-nav";
import { Reveal } from "@/components/storefront/reveal";
import type { CategoryTreeNode } from "@/lib/storefront-categories";

// All images (logo, banner, product/service photos) come from the store
// owner's own uploads — nothing here is hardcoded artwork. This template is
// structurally different from Fresh & Co. and Heenzy on purpose: a sticky
// side rail instead of a top nav, a split-screen hero instead of full-bleed,
// numbered full-width catalog rows instead of a card grid, and a serif
// display face — so picking it visibly changes the shape of the page, not
// just its color.
//
// Colors/type/spacing below are driven entirely by the `theme` prop (a
// TemplateTheme, e.g. NOVA_THEME or NOVA_IVORY_THEME from
// lib/template-themes.ts) instead of the hardcoded NOVA constant, so this
// one component can render every Nova Studio variant. `theme` defaults to
// NOVA_THEME so existing callers that don't pass it are unaffected.

type CatalogItem = {
  id: string; kind: "product" | "service"; name: string; description: string | null;
  price: number; currency: string; image: string | null; categoryName: string | null;
  type: string; rentalUnit: string | null; isBookable: boolean;
};
type Review = { id: string; rating: number; comment: string | null; author: { name: string | null } };

/** Resolves the optional style-pack tokens (muted/border/density) to concrete values, and derives layout constants from `density`. */
function resolveNovaPalette(theme: TemplateTheme) {
  const compact = theme.density === "compact";
  return {
    bg: theme.bg,
    ink: theme.ink,
    card: theme.card,
    gold: theme.accent,
    gray: theme.muted ?? NOVA.gray,
    line: theme.border ?? NOVA.line,
    font: theme.font,
    serif: { fontFamily: theme.headlineFont } as React.CSSProperties,
    // Compact variants (e.g. Ivory Minimal) get noticeably tighter section
    // padding and hero height — not just a palette swap.
    sectionPad: compact ? "70px" : "120px",
    heroMinHeight: compact ? "70vh" : "82vh",
    navPad: compact ? "20px 60px" : "26px 60px",
  };
}

export function NovaStorefront({
  store, slug, catalogItems, navCategories, goodReviews, avgRating, completedOrders, trustScore, trustChecklist, social, theme = NOVA_THEME, heroOverrides,
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
  /** Which Nova Studio variant to render (colors, type, spacing). Defaults to the original Noir theme. */
  theme?: TemplateTheme;
  /** Vendor's click-to-edit hero text overrides (see components/dashboard/hero-block-editor.tsx). Falls back to store.name/description/theme text when a key is absent, same as the default template. */
  heroOverrides?: { headline?: string; subtitle?: string; ctaLabel?: string } | null;
}) {
  const p = resolveNovaPalette(theme);
  const label: React.CSSProperties = { fontFamily: "monospace", fontSize: 11, letterSpacing: "0.22em", textTransform: "uppercase", color: p.gold };
  const wrap: React.CSSProperties = { maxWidth: 1320, margin: "0 auto", padding: "0 60px" };
  const heroImage = store.bannerUrl;
  const featuredItems = catalogItems.slice(0, 8);

  return (
    <div style={{ background: p.bg, color: p.ink, fontFamily: p.font, minHeight: "100vh" }} className="storefront-root">
      {/* ---------- SIDE RAIL NAV (sticky, not a top bar) ---------- */}
      <div style={{ position: "sticky", top: 0, zIndex: 50, display: "flex", alignItems: "center", justifyContent: "space-between", padding: p.navPad, borderBottom: `1px solid ${p.line}`, background: p.bg, backdropFilter: "blur(10px)" }}>
        <a href={`/${slug}`} style={{ ...p.serif, fontSize: 22, fontWeight: 700, color: p.ink, textDecoration: "none", letterSpacing: "0.02em" }}>
          {store.logoUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={store.logoUrl} alt={store.name} style={{ height: 30, width: 30, borderRadius: "50%", objectFit: "cover", marginRight: 10, verticalAlign: "middle" }} />
          ) : null}
          {store.name}
        </a>
        <div style={{ display: "flex", alignItems: "center", gap: 26 }}>
          {catalogItems.length > 0 && <a href="#collection" style={{ ...label, textDecoration: "none" }}>The Collection</a>}
          {catalogItems.length > 0 && <a href={`/${slug}/search`} style={{ ...label, textDecoration: "none" }}>Search</a>}
          <CartLink storeSlug={slug} accent={p.gold} ink={p.ink} />
          <AccountLink storeSlug={slug} ink={p.ink} />
        </div>
      </div>

      <CategoryNav slug={slug} categories={navCategories} accent={p.gold} ink={p.ink} bg={p.bg} border={p.line} />

      {/* ---------- SPLIT HERO ---------- */}
      <header className="bn-2col" style={{ display: "grid", gridTemplateColumns: "1.1fr 0.9fr", minHeight: p.heroMinHeight, "--bn-cols": "1.1fr 0.9fr" } as React.CSSProperties}>
        <div style={{ display: "flex", flexDirection: "column", justifyContent: "center", padding: "0 60px" }}>
          <div style={label}>{theme.eyebrow}</div>
          <h1 style={{ ...p.serif, fontSize: "clamp(40px,5.6vw,72px)", lineHeight: 1.04, margin: "22px 0 0", fontWeight: 700 }}>
            {heroOverrides?.headline || store.name}
          </h1>
          <p style={{ marginTop: 24, maxWidth: 460, fontSize: 16, lineHeight: 1.75, color: p.gray }}>
            {heroOverrides?.subtitle || store.business.description || theme.sub}
          </p>
          {catalogItems.length > 0 && (
            <a href="#collection" style={{ marginTop: 36, display: "inline-flex", alignItems: "center", gap: 12, width: "fit-content", padding: "16px 0", borderTop: `1px solid ${p.line}`, borderBottom: `1px solid ${p.line}`, color: p.ink, textDecoration: "none", fontSize: 13, letterSpacing: "0.1em", textTransform: "uppercase" }}>
              {heroOverrides?.ctaLabel || theme.cta} <span style={{ color: p.gold }}>→</span>
            </a>
          )}
        </div>
        <div style={{ position: "relative", background: heroImage ? `url(${heroImage}) center/cover` : `linear-gradient(155deg, ${p.card}, ${p.bg})`, borderLeft: `1px solid ${p.line}` }}>
          {avgRating != null && (
            <div style={{ position: "absolute", left: 0, bottom: 40, background: p.gold, color: p.bg, padding: "16px 26px" }}>
              <b style={{ ...p.serif, fontSize: 22, display: "block" }}>{avgRating.toFixed(1)} / 5</b>
              {trustScore != null && <TrustBadge score={trustScore} style={{ marginTop: 4 }} />}
              {trustChecklist && (
                <div style={{ marginTop: 8 }}>
                  <TrustScorePanel checklist={trustChecklist} />
                </div>
              )}
              <span style={{ fontSize: 11, letterSpacing: "0.08em", textTransform: "uppercase" }}>{goodReviews.length}+ reviews</span>
            </div>
          )}
        </div>
      </header>

      {/* ---------- ABOUT — full-width, centered, serif pull statement ---------- */}
      {store.business.description && (
        <section style={{ padding: `${p.sectionPad} 0`, borderTop: `1px solid ${p.line}` }}>
          <Reveal style={{ ...wrap, maxWidth: 900, textAlign: "center" }}>
            <div style={label}>What we believe</div>
            <p style={{ ...p.serif, fontSize: "clamp(24px,3.2vw,38px)", lineHeight: 1.4, marginTop: 22, color: p.ink }}>
              &ldquo;{store.business.description}&rdquo;
            </p>
          </Reveal>
        </section>
      )}

      {/* ---------- COLLECTION — a teaser of numbered rows, not the full catalog ---------- */}
      {featuredItems.length > 0 && (
        <section id="collection" style={{ padding: `0 0 ${p.sectionPad}`, borderTop: `1px solid ${p.line}` }}>
          <div style={wrap}>
            <Reveal>
              <div style={{ padding: "60px 0 40px", display: "flex", justifyContent: "space-between", alignItems: "flex-end", flexWrap: "wrap", gap: 16 }}>
                <div>
                  <div style={label}>{theme.catalogLabel}</div>
                  <h2 style={{ ...p.serif, fontSize: "clamp(30px,3.6vw,44px)", marginTop: 14 }}>Every piece, chosen with care.</h2>
                </div>
                <a href={`/${slug}/catalog`} style={{ ...label, textDecoration: "underline" }}>View full collection →</a>
              </div>
            </Reveal>
            {featuredItems.map((item, i) => (
              <Reveal key={`${item.kind}-${item.id}`} delayMs={i * 40} as="section">
                <a
                  href={`/${slug}/${item.kind === "product" ? "product" : "service"}/${item.id}`}
                  style={{ display: "grid", gridTemplateColumns: "80px 140px 1fr auto", alignItems: "center", gap: 30, padding: "30px 0", borderTop: `1px solid ${p.line}`, textDecoration: "none", color: "inherit" }}
                >
                  <span style={{ ...p.serif, fontSize: 15, color: p.gray }}>{String(i + 1).padStart(2, "0")}</span>
                  <div style={{ width: 140, height: 96, background: item.image ? `url(${item.image}) center/cover` : p.card, border: `1px solid ${p.line}` }} />
                  <div>
                    <h4 style={{ ...p.serif, fontSize: 20, fontWeight: 700 }}>{item.name}</h4>
                    {item.categoryName && <span style={{ ...label, marginTop: 6, display: "inline-block" }}>{item.categoryName}</span>}
                  </div>
                  <span style={{ ...p.serif, fontSize: 18, color: p.gold, whiteSpace: "nowrap" }}>{item.currency} {item.price.toLocaleString()}</span>
                </a>
              </Reveal>
            ))}
          </div>
        </section>
      )}

      {/* ---------- TESTIMONIAL — single large quote, not a card ---------- */}
      {goodReviews.length > 0 && goodReviews[0].comment && (
        <section style={{ padding: `${p.sectionPad} 0`, borderTop: `1px solid ${p.line}`, background: p.card }}>
          <Reveal style={{ ...wrap, maxWidth: 820, textAlign: "center" }}>
            <div style={{ color: p.gold, fontSize: 20, letterSpacing: 4, marginBottom: 22 }}>{"★".repeat(goodReviews[0].rating)}</div>
            <p style={{ ...p.serif, fontSize: "clamp(22px,2.8vw,32px)", lineHeight: 1.5 }}>&ldquo;{goodReviews[0].comment}&rdquo;</p>
            <p style={{ marginTop: 26, ...label }}>{goodReviews[0].author.name ?? "Verified client"}</p>
          </Reveal>
        </section>
      )}

      {/* ---------- STATS ---------- */}
      {(catalogItems.length > 0 || completedOrders > 0) && (
        <section style={{ padding: "70px 0", borderTop: `1px solid ${p.line}` }}>
          <div style={{ ...wrap, display: "flex", gap: 70, flexWrap: "wrap" }}>
            {catalogItems.length > 0 && (
              <div><b style={{ ...p.serif, fontSize: 34, display: "block", color: p.gold }}>{catalogItems.length}+</b><span style={label}>Pieces in the collection</span></div>
            )}
            {completedOrders > 0 && (
              <div><b style={{ ...p.serif, fontSize: 34, display: "block", color: p.gold }}>{completedOrders}+</b><span style={label}>Orders fulfilled</span></div>
            )}
          </div>
        </section>
      )}

      {/* ---------- NEWSLETTER ---------- */}
      <NovaNewsletter slug={slug} storeName={store.name} palette={p} />

      {/* ---------- CONTACT / FOOTER ---------- */}
      <footer style={{ padding: "70px 0 50px", borderTop: `1px solid ${p.line}` }}>
        <div style={{ ...wrap, display: "flex", justifyContent: "space-between", flexWrap: "wrap", gap: 30 }}>
          <div>
            <div style={{ ...p.serif, fontSize: 20, fontWeight: 700 }}>{store.name}</div>
            <p style={{ marginTop: 10, fontSize: 13, color: p.gray, maxWidth: 320 }}>{store.business.description}</p>
          </div>
          <div style={{ display: "flex", flexDirection: "column", gap: 10, fontSize: 13 }}>
            {social.whatsapp && <a href={`https://wa.me/${social.whatsapp}`} style={{ color: p.ink, textDecoration: "none" }}>WhatsApp</a>}
            {store.contactPhone && <a href={`tel:${store.contactPhone}`} style={{ color: p.ink, textDecoration: "none" }}>{store.contactPhone}</a>}
            {store.contactEmail && <a href={`mailto:${store.contactEmail}`} style={{ color: p.ink, textDecoration: "none" }}>{store.contactEmail}</a>}
          </div>
        </div>
      </footer>
    </div>
  );
}

function NovaNewsletter({ slug, storeName, palette: p }: { slug: string; storeName: string; palette: ReturnType<typeof resolveNovaPalette> }) {
  async function subscribe(formData: FormData) {
    "use server";
    await subscribeToNewsletter(slug, formData);
  }
  const label: React.CSSProperties = { fontFamily: "monospace", fontSize: 11, letterSpacing: "0.22em", textTransform: "uppercase", color: p.gold };
  const wrap: React.CSSProperties = { maxWidth: 1320, margin: "0 auto", padding: "0 60px" };
  return (
    <section style={{ padding: "80px 0", borderTop: `1px solid ${p.line}`, textAlign: "center" }}>
      <div style={wrap}>
        <div style={label}>Stay in the loop</div>
        <h2 style={{ ...p.serif, fontSize: "clamp(24px,3vw,32px)", marginTop: 14 }}>Join the {storeName} circle</h2>
        <form action={subscribe} style={{ display: "flex", justifyContent: "center", marginTop: 30, gap: 0, maxWidth: 460, margin: "30px auto 0" }}>
          <input name="email" type="email" required placeholder="Your email address" style={{ flex: 1, background: "transparent", border: `1px solid ${p.line}`, borderRight: "none", padding: "16px 18px", color: p.ink, fontSize: 14, outline: "none" }} />
          <button type="submit" style={{ background: p.gold, color: p.bg, border: "none", padding: "16px 26px", fontSize: 13, letterSpacing: "0.08em", textTransform: "uppercase", fontWeight: 600 }}>Join</button>
        </form>
      </div>
    </section>
  );
}
