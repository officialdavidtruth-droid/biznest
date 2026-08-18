import type React from "react";
import { CartLink } from "@/components/storefront/cart-link";
import { PREMIUM } from "@/lib/template-themes";
import { CategoryNav } from "@/components/storefront/category-nav";
import { subscribeToNewsletter } from "@/lib/actions/newsletter";
import type { CategoryTreeNode } from "@/lib/storefront-categories";

// Shared header + footer for the Premium Marketplace template, extracted
// from premium-home.tsx so every page of a Premium-templated store
// (product, category, catalog, search, cart, checkout, confirmation) shares
// the exact same topbar / dense nav / category sidebar strip / footer as
// the homepage, instead of each page falling back to the generic nav.

export const wrap: React.CSSProperties = { width: "90%", maxWidth: 1200, margin: "0 auto" };

type ChromeStore = {
  name: string;
  logoUrl: string | null;
  contactEmail: string | null;
  contactPhone: string | null;
  business: { description: string | null };
};

export function PremiumHeader({
  store,
  slug,
  navCategories,
  crumbs,
}: {
  store: ChromeStore;
  slug: string;
  navCategories: CategoryTreeNode[];
  /** Optional breadcrumb trail rendered just under the category nav, e.g. Home / Category / Product */
  crumbs?: React.ReactNode;
}) {
  return (
    <>
      {/* ---------- TOPBAR ---------- */}
      <div style={{ height: 30, background: PREMIUM.topbar, display: "flex", justifyContent: "space-between", alignItems: "center", padding: "0 5%", fontSize: 10, color: "#5d6870" }}>
        <span>{store.business.description ? store.business.description.slice(0, 60) : store.name}</span>
        <span>{store.contactPhone || store.contactEmail || ""}</span>
      </div>

      {/* ---------- NAV ---------- */}
      <header style={{ height: 68, background: "#fff", borderBottom: "1px solid #e2e7e9", display: "flex", alignItems: "center", gap: 16, padding: "0 4.8%", position: "sticky", top: 0, zIndex: 20 }}>
        <a href={`/${slug}`} style={{ fontSize: 21, fontWeight: 900, minWidth: 175, textDecoration: "none", color: PREMIUM.ink, display: "flex", alignItems: "center", gap: 8 }}>
          {store.logoUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={store.logoUrl} alt={store.name} style={{ height: 32, width: 32, borderRadius: "50%", objectFit: "cover" }} />
          ) : null}
          {store.name}
        </a>
        <div style={{ height: 38, border: "1px solid #dfe4e7", borderRadius: 22, display: "flex", alignItems: "center", padding: "0 8px 0 12px", flex: 1, maxWidth: 430, color: "#8a949a" }}>
          ⌕<span style={{ marginLeft: 7, fontSize: 12 }}>Search the catalog…</span>
        </div>
        <nav style={{ display: "flex", gap: 15, fontSize: 11, fontWeight: 700 }}>
          <a href={`/store/${slug}/catalog`} style={{ textDecoration: "none", color: PREMIUM.ink }}>Shop</a>
          {navCategories.length > 0 && <a href={`/store/${slug}/catalog`} style={{ textDecoration: "none", color: PREMIUM.ink }}>Categories</a>}
        </nav>
        <div style={{ marginLeft: "auto", display: "flex", gap: 15, alignItems: "center" }}>
          <CartLink storeSlug={slug} accent={PREMIUM.accent} ink={PREMIUM.ink} />
        </div>
      </header>

      <CategoryNav slug={slug} categories={navCategories} accent={PREMIUM.accent} ink={PREMIUM.ink} bg="#fff" border="#e2e7e9" />

      {crumbs && (
        <div style={{ ...wrap, fontSize: 10.5, opacity: 0.65, padding: "14px 0 0" }}>{crumbs}</div>
      )}
    </>
  );
}

export function PremiumFooter({
  store,
  slug,
  social,
}: {
  store: ChromeStore;
  slug: string;
  social: Record<string, string>;
}) {
  async function subscribeNewsletter(formData: FormData) {
    "use server";
    await subscribeToNewsletter(slug, formData);
  }

  return (
    <>
      {/* ---------- NEWSLETTER ---------- */}
      <section style={{ background: "#1e2429", color: "#fff", padding: "30px 5%" }}>
        <div style={{ ...wrap, textAlign: "center" }}>
          <h3 style={{ fontSize: 16, marginBottom: 6 }}>Stay in the loop</h3>
          <p style={{ fontSize: 11, opacity: 0.75, marginBottom: 14 }}>New arrivals and offers from {store.name}, straight to your inbox.</p>
          <form action={subscribeNewsletter} style={{ display: "flex", gap: 8, justifyContent: "center", flexWrap: "wrap" }}>
            <input type="hidden" name="slug" value={slug} />
            <input name="email" type="email" required placeholder="you@example.com" style={{ borderRadius: 20, border: 0, padding: "10px 16px", minWidth: 240, fontSize: 12 }} />
            <button type="submit" style={{ background: PREMIUM.accent, color: "#fff", border: 0, borderRadius: 20, padding: "10px 16px", fontWeight: 800, cursor: "pointer", fontSize: 12 }}>Subscribe</button>
          </form>
        </div>
      </section>

      {/* ---------- FOOTER ---------- */}
      <footer style={{ background: "#fff", borderTop: "1px solid #dfe5e8", padding: "30px 5%", display: "grid", gridTemplateColumns: "2fr 1fr 1fr", gap: 20 }}>
        <div>
          <b style={{ fontSize: 12 }}>{store.name}</b>
          <p style={{ color: "#6e7980", fontSize: 10, margin: "6px 0" }}>{store.business.description || "Enterprise commerce made simple."}</p>
          {store.contactEmail && <p style={{ color: "#6e7980", fontSize: 10, margin: "6px 0" }}>{store.contactEmail}</p>}
          {store.contactPhone && <p style={{ color: "#6e7980", fontSize: 10, margin: "6px 0" }}>{store.contactPhone}</p>}
        </div>
        <div>
          <b style={{ fontSize: 12 }}>Shop</b>
          <a href={`/store/${slug}/catalog`} style={{ display: "block", color: "#6e7980", fontSize: 10, margin: "6px 0", textDecoration: "none" }}>Catalog</a>
        </div>
        <div>
          <b style={{ fontSize: 12 }}>Support</b>
          <a href={`/store/${slug}/cart`} style={{ display: "block", color: "#6e7980", fontSize: 10, margin: "6px 0", textDecoration: "none" }}>Cart</a>
          {Object.entries(social).map(([k, v]) => (
            <a key={k} href={v} style={{ display: "block", color: "#6e7980", fontSize: 10, margin: "6px 0", textDecoration: "none" }}>{k}</a>
          ))}
        </div>
      </footer>
    </>
  );
}
