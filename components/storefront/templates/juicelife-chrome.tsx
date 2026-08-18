import type React from "react";
import { CartLink } from "@/components/storefront/cart-link";
import { JUICELIFE } from "@/lib/template-themes";
import { CategoryNav } from "@/components/storefront/category-nav";
import type { CategoryTreeNode } from "@/lib/storefront-categories";

// Shared header + footer for the JuiceLife template, extracted from
// juicelife-home.tsx so every page of a JuiceLife-templated store
// (product, category, catalog, search, cart, checkout) shares the exact
// same green topbar / sticky nav / category strip / rounded-pill footer
// as the homepage, instead of falling back to the generic bar every
// unfinished template used (same fix already applied to Violet,
// Marketplace Hub, Arcova, Nova, Premium Marketplace, HomeVista, rRW,
// Heenzy, Rivora and Fabtex).

// See rivora-chrome.tsx for why maxWidth matters: without it, this wrap
// stretches edge-to-edge on wide screens, and anything sized as a fraction
// of it (e.g. a 1/1 aspect-ratio product photo) balloons on large monitors.
export const wrap: React.CSSProperties = { maxWidth: 1180, margin: "0 auto", padding: "0 6%" };

type ChromeStore = {
  name: string;
  logoUrl: string | null;
  contactEmail: string | null;
  contactPhone: string | null;
  business: { description: string | null };
};

export function JuiceLifeHeader({
  store,
  slug,
  navCategories,
  crumbs,
}: {
  store: ChromeStore;
  slug: string;
  navCategories: CategoryTreeNode[];
  /** Optional breadcrumb trail rendered just under the category strip, e.g. Home / Category / Product */
  crumbs?: React.ReactNode;
}) {
  return (
    <>
      {/* ---------- TOPBAR ---------- */}
      <div style={{ height: 30, background: JUICELIFE.greenDark, color: "#fff", fontSize: 11, ...wrap, display: "flex", alignItems: "center", justifyContent: "space-between" }}>
        <span>🍃 Free delivery on orders over $30</span>
        <span>{store.contactPhone ? `☎ ${store.contactPhone}` : ""} {store.contactEmail ? `  ✉ ${store.contactEmail}` : ""}</span>
      </div>

      {/* ---------- NAV ---------- */}
      <header style={{ height: 82, display: "flex", alignItems: "center", ...wrap, gap: 30, background: "#fff", position: "sticky", top: 0, zIndex: 20, borderBottom: "1px solid #edf1ea" }}>
        <a href={`/${slug}`} style={{ fontWeight: 800, fontSize: 22, color: JUICELIFE.green, lineHeight: 0.8, textDecoration: "none", display: "flex", alignItems: "center", gap: 8 }}>
          {store.logoUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={store.logoUrl} alt={store.name} style={{ height: 34, width: "auto", borderRadius: 6 }} />
          ) : (
            <span>🍃 {store.name}</span>
          )}
        </a>
        <nav style={{ display: "flex", gap: 24, margin: "0 auto", fontSize: 12 }}>
          <a href={`/${slug}`} style={{ color: JUICELIFE.ink, textDecoration: "none" }}>Home</a>
          <a href={`/${slug}/catalog`} style={{ color: JUICELIFE.ink, textDecoration: "none" }}>Shop</a>
          <a href={`/${slug}/search`} style={{ color: JUICELIFE.ink, textDecoration: "none" }}>Search</a>
        </nav>
        <CartLink storeSlug={slug} accent={JUICELIFE.green} onAccent="#ffffff" ink={JUICELIFE.ink} />
      </header>

      <CategoryNav slug={slug} categories={navCategories} accent={JUICELIFE.green} ink={JUICELIFE.ink} bg="#fff" border="#edf1ea" />

      {crumbs && (
        <div style={{ ...wrap, fontSize: 11.5, color: JUICELIFE.muted, padding: "16px 6% 0" }}>{crumbs}</div>
      )}
    </>
  );
}

export function JuiceLifeFooter({
  store,
  slug,
  social,
}: {
  store: ChromeStore;
  slug: string;
  social: Record<string, string>;
}) {
  return (
    <footer style={{ padding: "38px 7% 20px", display: "grid", gridTemplateColumns: "1.5fr 1fr 1fr", gap: 30, fontSize: 10, color: "#697169", background: "#fff" }}>
      <div>
        <div style={{ fontWeight: 800, fontSize: 18, color: JUICELIFE.green, marginBottom: 10 }}>🍃 {store.name}</div>
        <p>{store.business.description || "Fresh. Healthy. Delicious. Every day."}</p>
      </div>
      <div>
        <h4 style={{ color: "#222", margin: "0 0 15px", fontSize: 11 }}>Contact us</h4>
        {store.contactPhone && <p style={{ margin: "7px 0" }}>☎ {store.contactPhone}</p>}
        {store.contactEmail && <p style={{ margin: "7px 0" }}>✉ {store.contactEmail}</p>}
        <a href={`/${slug}`} style={{ display: "block", margin: "7px 0", color: "#697169", textDecoration: "none" }}>Back to shop</a>
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
  );
}
