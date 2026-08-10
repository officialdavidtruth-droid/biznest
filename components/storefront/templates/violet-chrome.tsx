import type React from "react";
import { CartLink } from "@/components/storefront/cart-link";
import { VIOLET, VIOLET_THEME, type TemplateTheme } from "@/lib/template-themes";
import { CategoryNav } from "@/components/storefront/category-nav";
import { subscribeToNewsletter } from "@/lib/actions/newsletter";
import type { CategoryTreeNode } from "@/lib/storefront-categories";

// Shared header + footer for the Violet template, extracted from
// violet-home.tsx so every page of a Violet-templated store (product,
// category, catalog, search, cart, checkout, confirmation) shares the exact
// same topbar / nav / search pill / category strip / footer as the
// homepage, instead of each page inventing its own generic bar.
//
// `theme` defaults to VIOLET_THEME so the existing call sites that don't
// pass it yet keep rendering exactly as before — same non-breaking pattern
// as nova-chrome.tsx.

export const wrap: React.CSSProperties = { width: "90%", maxWidth: 1200, margin: "0 auto" };

type ChromeStore = {
  name: string;
  logoUrl: string | null;
  contactEmail: string | null;
  contactPhone: string | null;
  business: { description: string | null };
};

export function VioletHeader({
  store,
  slug,
  navCategories,
  crumbs,
  theme = VIOLET_THEME,
}: {
  store: ChromeStore;
  slug: string;
  navCategories: CategoryTreeNode[];
  /** Optional breadcrumb trail rendered just under the category strip, e.g. Home / Category / Product */
  crumbs?: React.ReactNode;
  theme?: TemplateTheme;
}) {
  const navy = theme.surfaceDark ?? theme.ink;
  const border = theme.border ?? "#eeeeee";
  return (
    <>
      {/* ---------- TOPBAR ---------- */}
      <div style={{ background: navy, color: "#fff", textAlign: "center", padding: 9, fontSize: 12 }}>
        {store.contactPhone ? `Questions? Call ${store.contactPhone}` : `Welcome to ${store.name}`}
      </div>

      {/* ---------- NAV ---------- */}
      <header
        style={{
          height: 72, background: theme.card, borderBottom: `1px solid ${border}`, display: "flex",
          alignItems: "center", gap: 25, padding: "0 5%", position: "sticky", top: 0, zIndex: 20,
        }}
      >
        <a href={`/store/${slug}`} style={{ fontSize: 24, fontWeight: 900, textDecoration: "none", color: theme.ink, display: "flex", alignItems: "center", gap: 10 }}>
          {store.logoUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={store.logoUrl} alt={store.name} style={{ height: 34, width: 34, borderRadius: "50%", objectFit: "cover" }} />
          ) : null}
          {store.name}
        </a>
        <form action={`/store/${slug}/search`} style={{ height: 44, borderRadius: 25, background: "#f4f4f7", color: "#888", display: "flex", alignItems: "center", padding: "0 15px", flex: 1, maxWidth: 520 }}>
          ⌕
          <input name="q" placeholder="Search products, brands and categories" style={{ marginLeft: 8, fontSize: 13, border: 0, background: "transparent", outline: "none", flex: 1, color: theme.ink }} />
        </form>
        <nav style={{ display: "flex", gap: 18, fontSize: 13, fontWeight: 700 }}>
          <a href={`/store/${slug}/catalog`} style={{ textDecoration: "none", color: theme.ink }}>Shop</a>
          {navCategories.length > 0 && <a href={`/store/${slug}/catalog`} style={{ textDecoration: "none", color: theme.ink }}>Categories</a>}
        </nav>
        <div style={{ display: "flex", gap: 15, alignItems: "center" }}>
          <CartLink storeSlug={slug} accent={theme.accent} ink={theme.ink} />
        </div>
      </header>

      <CategoryNav slug={slug} categories={navCategories} accent={theme.accent} ink={theme.ink} bg={theme.card} border={border} />

      {crumbs && (
        <div style={{ ...wrap, fontSize: 12.5, opacity: 0.65, padding: "18px 0 0" }}>{crumbs}</div>
      )}
    </>
  );
}

export function VioletFooter({
  store,
  slug,
  social,
  theme = VIOLET_THEME,
}: {
  store: ChromeStore;
  slug: string;
  social: Record<string, string>;
  theme?: TemplateTheme;
}) {
  async function subscribeNewsletter(formData: FormData) {
    "use server";
    await subscribeToNewsletter(slug, formData);
  }
  const navy = theme.surfaceDark ?? theme.ink;

  return (
    <>
      {/* ---------- NEWSLETTER ---------- */}
      <section style={{ background: navy, color: "#fff", padding: "40px 5%" }}>
        <div style={{ ...wrap, textAlign: "center" }}>
          <h3 style={{ fontSize: 20, marginBottom: 8 }}>Stay in the loop</h3>
          <p style={{ fontSize: 13, opacity: 0.75, marginBottom: 18 }}>New arrivals and offers from {store.name}, straight to your inbox.</p>
          <form action={subscribeNewsletter} style={{ display: "flex", gap: 10, justifyContent: "center", flexWrap: "wrap" }}>
            <input type="hidden" name="slug" value={slug} />
            <input name="email" type="email" required placeholder="you@example.com" style={{ borderRadius: 25, border: 0, padding: "13px 18px", minWidth: 260, fontSize: 13 }} />
            <button type="submit" style={{ background: theme.accent, color: "#fff", border: 0, borderRadius: 25, padding: "13px 21px", fontWeight: 800, cursor: "pointer" }}>Subscribe</button>
          </form>
        </div>
      </section>

      {/* ---------- FOOTER ---------- */}
      <footer style={{ background: navy, color: "#fff", padding: "42px 5%", display: "grid", gridTemplateColumns: "2fr 1fr 1fr", gap: 30 }}>
        <div>
          <b style={{ fontSize: 16 }}>{store.name}</b>
          <p style={{ color: "#aaa", fontSize: 12, margin: "9px 0" }}>{store.business.description || "Modern commerce storefront."}</p>
          {store.contactEmail && <p style={{ color: "#aaa", fontSize: 12, margin: "9px 0" }}>{store.contactEmail}</p>}
          {store.contactPhone && <p style={{ color: "#aaa", fontSize: 12, margin: "9px 0" }}>{store.contactPhone}</p>}
        </div>
        <div>
          <b style={{ fontSize: 16 }}>Shop</b>
          <a href={`/store/${slug}/catalog`} style={{ display: "block", color: "#aaa", fontSize: 12, margin: "9px 0", textDecoration: "none" }}>Catalog</a>
        </div>
        <div>
          <b style={{ fontSize: 16 }}>Support</b>
          <a href={`/store/${slug}/cart`} style={{ display: "block", color: "#aaa", fontSize: 12, margin: "9px 0", textDecoration: "none" }}>Cart</a>
          {Object.entries(social).map(([k, v]) => (
            <a key={k} href={v} style={{ display: "block", color: "#aaa", fontSize: 12, margin: "9px 0", textDecoration: "none" }}>{k}</a>
          ))}
        </div>
      </footer>
    </>
  );
}
