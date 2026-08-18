import type React from "react";
import { CartLink } from "@/components/storefront/cart-link";
import { HOMEVISTA } from "@/lib/template-themes";
import { CategoryNav } from "@/components/storefront/category-nav";
import type { CategoryTreeNode } from "@/lib/storefront-categories";

// Shared header + footer for the HomeVista template, extracted from
// homevista-home.tsx so every page of a HomeVista-templated store
// (product, category, catalog, search, cart, checkout) shares the exact
// same topbar / nav / green-teal real-estate look as the homepage,
// instead of each page falling back to the generic default bar (same fix
// already applied to Violet, Marketplace Hub, Arcova, Nova and Premium).

export const wrap: React.CSSProperties = { width: "90%", maxWidth: 1200, margin: "0 auto" };

type ChromeStore = {
  name: string;
  logoUrl: string | null;
  contactEmail: string | null;
  contactPhone: string | null;
  business: { description: string | null };
};

export function HomeVistaHeader({
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
      <div style={{ height: 30, background: HOMEVISTA.topbar, display: "flex", justifyContent: "space-between", alignItems: "center", padding: "0 4.5%", fontSize: 9, color: "#526164" }}>
        <span>{store.contactEmail ? `✉ ${store.contactEmail}` : ""} {store.contactPhone ? `☎ ${store.contactPhone}` : ""}</span>
        <span></span>
      </div>

      {/* ---------- NAV ---------- */}
      <header style={{ height: 70, display: "flex", alignItems: "center", padding: "0 4.5%", gap: 28, borderBottom: "1px solid #edf0ef", background: "#fff" }}>
        <a href={`/${slug}`} style={{ fontSize: 19, color: HOMEVISTA.dark, minWidth: 175, textDecoration: "none", display: "flex", alignItems: "center", gap: 8 }}>
          {store.logoUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={store.logoUrl} alt={store.name} style={{ height: 32, width: 32, borderRadius: "50%", objectFit: "cover" }} />
          ) : (
            <span>⌂</span>
          )}
          <b>{store.name}</b>
        </a>
        <nav style={{ display: "flex", gap: 25, fontSize: 11, fontWeight: 700 }}>
          <a href={`/${slug}#listings`} style={{ textDecoration: "none", color: HOMEVISTA.ink }}>Listings</a>
          {navCategories.length > 0 && <a href={`/${slug}/catalog`} style={{ textDecoration: "none", color: HOMEVISTA.accent, borderBottom: `2px solid ${HOMEVISTA.accent}`, paddingBottom: 25 }}>Categories</a>}
        </nav>
        <div style={{ marginLeft: "auto", display: "flex", alignItems: "center", gap: 20 }}>
          <CartLink storeSlug={slug} accent={HOMEVISTA.accent} ink={HOMEVISTA.ink} />
        </div>
      </header>

      <CategoryNav slug={slug} categories={navCategories} accent={HOMEVISTA.accent} ink={HOMEVISTA.ink} bg="#fff" border="#edf0ef" />

      {crumbs && (
        <div style={{ ...wrap, fontSize: 11, opacity: 0.65, padding: "18px 0 0" }}>{crumbs}</div>
      )}
    </>
  );
}

export function HomeVistaFooter({
  store,
  slug,
  social,
}: {
  store: ChromeStore;
  slug: string;
  social: Record<string, string>;
}) {
  return (
    <footer style={{ background: HOMEVISTA.footer, color: "#fff", marginTop: 30, padding: "30px 5%", display: "grid", gridTemplateColumns: "1.5fr repeat(4, 1fr)", gap: 25 }}>
      <div>
        <b style={{ fontSize: 18 }}>⌂ {store.name}</b>
        <p style={{ color: "#b8cbc7", fontSize: 8, margin: "7px 0" }}>{store.business.description || "Your trusted partner in finding the perfect place."}</p>
      </div>
      <div>
        <b style={{ fontSize: 11 }}>Quick Links</b>
        <a href={`/${slug}/catalog`} style={{ display: "block", color: "#b8cbc7", fontSize: 8, margin: "7px 0", textDecoration: "none" }}>Listings</a>
        <a href={`/${slug}/cart`} style={{ display: "block", color: "#b8cbc7", fontSize: 8, margin: "7px 0", textDecoration: "none" }}>Cart</a>
      </div>
      <div>
        <b style={{ fontSize: 11 }}>Contact</b>
        {store.contactEmail && <p style={{ color: "#b8cbc7", fontSize: 8, margin: "7px 0" }}>{store.contactEmail}</p>}
        {store.contactPhone && <p style={{ color: "#b8cbc7", fontSize: 8, margin: "7px 0" }}>{store.contactPhone}</p>}
      </div>
      <div>
        <b style={{ fontSize: 11 }}>Follow</b>
        {Object.entries(social).map(([k, v]) => (
          <a key={k} href={v} style={{ display: "block", color: "#b8cbc7", fontSize: 8, margin: "7px 0", textDecoration: "none" }}>{k}</a>
        ))}
      </div>
      <small style={{ gridColumn: "1/-1", borderTop: "1px solid #294a46", paddingTop: 12, color: "#9eb4b0", fontSize: 8 }}>© {new Date().getFullYear()} {store.name}. All rights reserved.</small>
    </footer>
  );
}
