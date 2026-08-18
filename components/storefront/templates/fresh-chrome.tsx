import type React from "react";
import { CartLink } from "@/components/storefront/cart-link";
import { CategoryNav } from "@/components/storefront/category-nav";
import { FRESH } from "@/lib/template-themes";
import type { CategoryTreeNode } from "@/lib/storefront-categories";

// Shared header + footer for the "Fresh & Co." template, extracted from
// app/store/[slug]/page.tsx so every other page of a Fresh-templated store
// (product, category, catalog, search, cart, checkout) shares the exact
// same nav / category strip / footer as the homepage, instead of falling
// back to the generic bare bar every other unfinished template used
// (same fix already applied to Violet, Marketplace Hub, Arcova, Nova,
// Premium Marketplace, HomeVista, rRW, Heenzy, Rivora, JuiceLife, Fabtex —
// Fresh & Co. was the last template still missing this).

export const wrap: React.CSSProperties = { maxWidth: 1180, margin: "0 auto", padding: "0 28px" };
export const line = "rgba(18,53,36,0.10)";
const btnPrimary: React.CSSProperties = { display: "inline-flex", alignItems: "center", gap: 10, padding: "11px 20px", borderRadius: 100, fontWeight: 600, fontSize: 13.5, background: FRESH.leaf, color: "#fff", textDecoration: "none", whiteSpace: "nowrap" };
const footHead: React.CSSProperties = { color: "#fff", fontFamily: "monospace", fontSize: 11.5, letterSpacing: "0.08em", textTransform: "uppercase", marginBottom: 16 };
const footLink: React.CSSProperties = { fontSize: 13.5, marginBottom: 10 };

type ChromeStore = {
  name: string;
  logoUrl: string | null;
  contactEmail: string | null;
  contactPhone: string | null;
  business: { description: string | null } | null;
};

export function FreshHeader({
  store,
  slug,
  navCategories,
  crumbs,
  hasCatalog = true,
}: {
  store: ChromeStore;
  slug: string;
  navCategories: CategoryTreeNode[];
  /** Optional breadcrumb trail rendered just under the category strip, e.g. Home / Category / Product */
  crumbs?: React.ReactNode;
  hasCatalog?: boolean;
}) {
  return (
    <>
      <nav style={{ position: "sticky", top: 0, zIndex: 50, background: "rgba(251,249,244,.9)", backdropFilter: "blur(10px)", borderBottom: `1px solid ${line}` }}>
        <div style={{ ...wrap, display: "flex", alignItems: "center", justifyContent: "space-between", padding: "14px 28px" }}>
          <a href={`/${slug}`} style={{ fontFamily: FRESH.headlineFont, fontWeight: 700, fontSize: 21, color: FRESH.forest, display: "flex", alignItems: "center", gap: 8, textDecoration: "none" }}>
            {store.logoUrl ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={store.logoUrl} alt={store.name} style={{ height: 30, width: 30, borderRadius: 8, objectFit: "cover" }} />
            ) : (
              <span style={{ width: 9, height: 9, borderRadius: "50%", background: FRESH.citrus, display: "inline-block" }} />
            )}
            {store.name}
          </a>
          <div style={{ display: "flex", alignItems: "center", gap: 16 }}>
            {hasCatalog && <a href={`/${slug}/search`} style={{ fontSize: 14, fontWeight: 500, color: FRESH.inkSoft, textDecoration: "none" }}>Search</a>}
            <CartLink storeSlug={slug} accent={FRESH.leaf} ink={FRESH.ink} />
            {hasCatalog && <a href={`/${slug}/catalog`} style={btnPrimary}>Get a Quote</a>}
          </div>
        </div>
      </nav>
      <CategoryNav slug={slug} categories={navCategories} accent={FRESH.leaf} ink={FRESH.ink} bg={FRESH.ivory} border={line} />
      {crumbs && (
        <div style={{ ...wrap, padding: "16px 28px 0", fontSize: 12.5, opacity: 0.65 }}>{crumbs}</div>
      )}
    </>
  );
}

export function FreshFooter({
  store,
  slug,
  catalogCategories = [],
  catalogLabel = "Catalog",
  hasCatalog = true,
}: {
  store: ChromeStore;
  slug: string;
  catalogCategories?: string[];
  catalogLabel?: string;
  hasCatalog?: boolean;
}) {
  return (
    <footer style={{ background: FRESH.forestDark, color: "rgba(255,255,255,.6)", padding: "48px 0 0", marginTop: 40 }}>
      <div style={{ ...wrap, display: "grid", gridTemplateColumns: "1.4fr 1fr 1fr 1.2fr", gap: 36, paddingBottom: 36, borderBottom: "1px solid rgba(255,255,255,.1)" }}>
        <div>
          <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 12 }}>
            {store.logoUrl ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={store.logoUrl} alt={store.name} style={{ height: 26, width: 26, borderRadius: 6, objectFit: "cover" }} />
            ) : (
              <div style={{ height: 26, width: 26, borderRadius: 6, background: FRESH.citrus }} />
            )}
            <span style={{ fontFamily: FRESH.headlineFont, fontWeight: 700, fontSize: 15, color: "#fff" }}>{store.name}</span>
          </div>
          {store.business?.description && (
            <p style={{ fontSize: 13, lineHeight: 1.7, maxWidth: 250 }}>
              {store.business.description.length > 140 ? store.business.description.slice(0, 140) + "…" : store.business.description}
            </p>
          )}
        </div>
        <div>
          <h5 style={footHead}>Services</h5>
          {catalogCategories.slice(0, 4).map((c) => <div key={c} style={footLink}>{c}</div>)}
        </div>
        <div>
          <h5 style={footHead}>Pages</h5>
          <div style={footLink}><a href={`/${slug}`} style={{ color: "inherit", textDecoration: "none" }}>Home</a></div>
          {hasCatalog && <div style={footLink}><a href={`/${slug}/catalog`} style={{ color: "inherit", textDecoration: "none" }}>{catalogLabel}</a></div>}
          <div style={footLink}>Contact</div>
        </div>
        <div>
          <h5 style={footHead}>Get in touch</h5>
          {store.contactEmail && <div style={footLink}>{store.contactEmail}</div>}
          {store.contactPhone && <div style={footLink}>{store.contactPhone}</div>}
        </div>
      </div>
      <div style={{ display: "flex", justifyContent: "space-between", padding: "20px 28px", fontSize: 12, flexWrap: "wrap", gap: 8, maxWidth: 1180, margin: "0 auto" }}>
        <span>© {new Date().getFullYear()} {store.name}. All rights reserved.</span>
        <span>Powered by BizNest</span>
      </div>
    </footer>
  );
}
