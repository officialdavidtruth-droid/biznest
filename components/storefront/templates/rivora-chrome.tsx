import type React from "react";
import { CartLink } from "@/components/storefront/cart-link";
import { RIVORA } from "@/lib/template-themes";
import { CategoryNav } from "@/components/storefront/category-nav";
import type { CategoryTreeNode } from "@/lib/storefront-categories";

// Shared header + footer for the Rivora Fresh template, extracted from
// rivora-home.tsx so every page of a Rivora-templated store (product,
// category, catalog, search, cart, checkout, confirmation) shares the
// exact same deep-green/lime topbar / sticky nav / category strip /
// footer as the homepage, instead of falling back to the generic bar
// every other unfinished template used (same fix already applied to
// Violet, Marketplace Hub, Arcova, Nova, Premium Marketplace, HomeVista,
// rRW, and Heenzy).

export const wrap: React.CSSProperties = { padding: "0 5%" };
export const RIVORA_BG = "#f7f9f6";

type ChromeStore = {
  name: string;
  logoUrl: string | null;
  contactEmail: string | null;
  contactPhone: string | null;
  business: { description: string | null };
};

export function RivoraHeader({
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
      <div style={{ height: 30, background: "#032718", color: "#dce8df", ...wrap, display: "flex", justifyContent: "space-between", alignItems: "center", fontSize: 10 }}>
        <span>Fresh picks, delivered fast</span>
        <span>{store.contactPhone ? `☎ ${store.contactPhone}` : ""} {store.contactEmail ? `  ✉ ${store.contactEmail}` : ""}</span>
      </div>

      {/* ---------- NAV ---------- */}
      <header style={{ height: 78, background: "#052d20", color: "#fff", ...wrap, display: "flex", alignItems: "center", gap: 28, position: "sticky", top: 0, zIndex: 30, borderBottom: "1px solid #164634" }}>
        <a href={`/store/${slug}`} style={{ display: "flex", alignItems: "center", gap: 8, color: "#fff", textDecoration: "none", minWidth: 180 }}>
          {store.logoUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={store.logoUrl} alt={store.name} style={{ height: 34, width: "auto", borderRadius: 6 }} />
          ) : (
            <b style={{ fontSize: 28, color: RIVORA.lime }}>{store.name.charAt(0).toUpperCase()}</b>
          )}
          <span style={{ fontWeight: 800, fontSize: 14 }}>{store.name}</span>
        </a>
        <nav style={{ display: "flex", gap: 22, flex: 1, justifyContent: "center", fontSize: 11 }}>
          <a href={`/store/${slug}`} style={{ color: "#d8e2dc", textDecoration: "none" }}>Home</a>
          <a href={`/store/${slug}/catalog`} style={{ color: "#d8e2dc", textDecoration: "none" }}>Shop</a>
          <a href={`/store/${slug}/search`} style={{ color: "#d8e2dc", textDecoration: "none" }}>Search</a>
        </nav>
        <CartLink storeSlug={slug} accent={RIVORA.lime} onAccent="#153600" ink="#fff" />
      </header>

      <CategoryNav slug={slug} categories={navCategories} accent={RIVORA.lime} ink="#fff" bg="#052d20" border="#164634" />

      {crumbs && (
        <div style={{ ...wrap, fontSize: 11.5, color: RIVORA.muted, padding: "16px 5% 0" }}>{crumbs}</div>
      )}
    </>
  );
}

export function RivoraFooter({
  store,
  slug,
  social,
}: {
  store: ChromeStore;
  slug: string;
  social: Record<string, string>;
}) {
  return (
    <footer style={{ background: "#03281c", color: "#9db0a7", marginTop: 32, padding: "32px 5% 18px", display: "grid", gridTemplateColumns: "1.4fr 1fr 1fr", gap: 25, fontSize: 10 }}>
      <div>
        <div style={{ display: "flex", alignItems: "center", gap: 8, color: "#fff", fontWeight: 800, marginBottom: 8 }}>{store.name}</div>
        <p>{store.business.description || "Fresh choices for a healthier, better life."}</p>
      </div>
      <div>
        <h4 style={{ color: "#fff", margin: "0 0 10px", fontSize: 11 }}>Contact</h4>
        {store.contactEmail && <p style={{ margin: "6px 0" }}>{store.contactEmail}</p>}
        {store.contactPhone && <p style={{ margin: "6px 0" }}>{store.contactPhone}</p>}
      </div>
      <div>
        <h4 style={{ color: "#fff", margin: "0 0 10px", fontSize: 11 }}>Follow us</h4>
        {Object.entries(social).map(([k, v]) => (
          <a key={k} href={v} style={{ display: "block", color: "#9db0a7", margin: "6px 0", textDecoration: "none" }}>{k}</a>
        ))}
      </div>
      <div style={{ gridColumn: "1 / -1", borderTop: "1px solid #164331", paddingTop: 13, fontSize: 9 }}>
        &copy; {new Date().getFullYear()} {store.name}. All rights reserved.
      </div>
    </footer>
  );
}
