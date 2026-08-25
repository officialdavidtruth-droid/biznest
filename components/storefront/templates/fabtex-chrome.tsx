import type React from "react";
import { CartLink } from "@/components/storefront/cart-link";
import { AccountLink } from "@/components/storefront/account-link";
import { FABTEX } from "@/lib/template-themes";
import { CategoryNav } from "@/components/storefront/category-nav";
import type { CategoryTreeNode } from "@/lib/storefront-categories";

// Shared header + footer for the Fabtex fabric/textile template,
// extracted from fabtex-home.tsx so every page of a Fabtex-templated
// store (product, category, catalog, search, cart, checkout) shares the
// exact same dark-industrial topbar / letter-spaced nav / category strip
// / footer as the homepage, instead of falling back to the generic bar
// every unfinished template used (same fix already applied to Violet,
// Marketplace Hub, Arcova, Nova, Premium Marketplace, HomeVista, rRW,
// Heenzy and Rivora).

// See rivora-chrome.tsx for why maxWidth matters: without it, this wrap
// stretches edge-to-edge on wide screens, and anything sized as a fraction
// of it (e.g. a 1/1 aspect-ratio product photo) balloons on large monitors.
export const wrap: React.CSSProperties = { maxWidth: 1180, margin: "0 auto", padding: "0 7%" };

type ChromeStore = {
  name: string;
  logoUrl: string | null;
  contactEmail: string | null;
  contactPhone: string | null;
  business: { description: string | null };
};

export function FabtexHeader({
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
      <div style={{ height: 30, background: "#181616", borderBottom: "1px solid #2c2929", ...wrap, display: "flex", alignItems: "center", justifyContent: "flex-end", gap: 20 }}>
        {store.contactPhone && <span style={{ fontSize: 9, color: "#aaa" }}>☎ {store.contactPhone}</span>}
        {store.contactEmail && <span style={{ fontSize: 9, color: "#aaa" }}>✉ {store.contactEmail}</span>}
      </div>

      {/* ---------- HEADER ---------- */}
      <header className="bn-header-inner" style={{ minHeight: 64, background: FABTEX.dark, ...wrap, display: "flex", alignItems: "center", gap: 30, borderBottom: "1px solid #343131", position: "sticky", top: 0, zIndex: 30 }}>
        <a href={`/${slug}`} style={{ fontWeight: 700, fontSize: 22, letterSpacing: 6, textDecoration: "none", color: "#fff", whiteSpace: "nowrap", display: "flex", alignItems: "center", gap: 10 }}>
          {store.logoUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={store.logoUrl} alt={store.name} style={{ height: 30, width: "auto" }} />
          ) : (
            store.name.toUpperCase()
          )}
        </a>
        <input type="checkbox" id={`bn-nav-${slug}-fabtex`} className="bn-nav-toggle" />
        <label htmlFor={`bn-nav-${slug}-fabtex`} className="bn-hamburger" style={{ color: "#fff", marginLeft: "auto" }} aria-label="Menu">&#9776;</label>
        <nav className="bn-nav-links" style={{ display: "flex", gap: 2, flex: 1 }}>
          <a href={`/${slug}`} style={{ fontSize: 10, textDecoration: "none", color: "#fff", padding: "10px 11px" }}>Home</a>
          <a href={`/${slug}/catalog`} style={{ fontSize: 10, textDecoration: "none", color: "#fff", padding: "10px 11px" }}>Catalog</a>
          <a href={`/${slug}/search`} style={{ fontSize: 10, textDecoration: "none", color: "#fff", padding: "10px 11px" }}>Search</a>
        </nav>
        <CartLink storeSlug={slug} accent={FABTEX.orange} onAccent="#ffffff" ink="#ffffff" />
        <AccountLink storeSlug={slug} ink="#ffffff" />
      </header>

      <CategoryNav slug={slug} categories={navCategories} accent={FABTEX.orange} ink="#fff" bg={FABTEX.dark} border="#343131" />

      {crumbs && (
        <div style={{ ...wrap, fontSize: 10, letterSpacing: 0.5, color: "#aaa", padding: "16px 7% 0" }}>{crumbs}</div>
      )}
    </>
  );
}

export function FabtexFooter({
  store,
  slug,
  social,
}: {
  store: ChromeStore;
  slug: string;
  social: Record<string, string>;
}) {
  return (
    <>
      <footer className="bn-2col" style={{ background: FABTEX.black, borderTop: "1px solid #333", padding: "38px 7%", display: "grid", gridTemplateColumns: "1.5fr 1fr 1fr", gap: 30, color: "#fff" }}>
        <div>
          <div style={{ fontWeight: 700, fontSize: 16, letterSpacing: 3 }}>{store.name.toUpperCase()}</div>
          <p style={{ fontSize: 9, color: "#777", lineHeight: 1.6, marginTop: 8 }}>
            {store.business.description || "The performance partner for hospitality, healthcare and commercial interiors."}
          </p>
        </div>
        <div>
          <h4 style={{ fontSize: 10, marginBottom: 10 }}>CONTACT</h4>
          {store.contactEmail && <p style={{ fontSize: 9, color: "#aaa" }}>{store.contactEmail}</p>}
          {store.contactPhone && <p style={{ fontSize: 9, color: "#aaa" }}>{store.contactPhone}</p>}
          <a href={`/${slug}`} style={{ display: "block", fontSize: 9, color: "#aaa", marginTop: 8, textDecoration: "none" }}>Back to shop</a>
        </div>
        <div>
          <h4 style={{ fontSize: 10, marginBottom: 10 }}>FOLLOW US</h4>
          {Object.entries(social).map(([k, v]) => (
            <a key={k} href={v} style={{ display: "block", textDecoration: "none", color: "#aaa", fontSize: 9, lineHeight: 1.9 }}>{k}</a>
          ))}
        </div>
      </footer>
      <div style={{ padding: "14px 7%", background: FABTEX.black, borderTop: "1px solid #222", color: "#666", fontSize: 8 }}>
        &copy; {new Date().getFullYear()} {store.name.toUpperCase()} STOREFRONT
      </div>
    </>
  );
}
