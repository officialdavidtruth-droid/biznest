import type React from "react";
import { CartLink } from "@/components/storefront/cart-link";
import { MARKETPLACE } from "@/lib/template-themes";
import { CategoryNav } from "@/components/storefront/category-nav";
import { subscribeToNewsletter } from "@/lib/actions/newsletter";
import type { CategoryTreeNode } from "@/lib/storefront-categories";

// Shared header + footer for the Marketplace Hub template, extracted from
// marketplace-home.tsx so every page of a Marketplace-templated store
// (product, category, catalog, search, cart, checkout, confirmation) shares
// the exact same topline / header / blue search bar / category strip /
// footer as the homepage, instead of each page inventing its own generic
// bar (same fix already applied to the Violet template).

export const wrap: React.CSSProperties = { width: "88%", maxWidth: 1120, margin: "0 auto" };

type ChromeStore = {
  name: string;
  logoUrl: string | null;
  contactEmail: string | null;
  contactPhone: string | null;
  business: { description: string | null };
};

export function MarketplaceHeader({
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
  const catalogCategories = navCategories.map((c) => c.name);

  return (
    <>
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
          <a href={`/${slug}/catalog`} style={{ color: "inherit" }}>SHOP</a>
          {store.business.description && <a href={`/${slug}#about`} style={{ color: "inherit" }}>ABOUT US</a>}
          {(store.contactEmail || store.contactPhone) && <a href={`/${slug}#contact`} style={{ color: "inherit" }}>CONTACT US</a>}
        </nav>
        <div style={{ marginLeft: "auto", display: "flex", gap: 16, alignItems: "center", fontSize: 10, color: "#555" }}>
          <CartLink storeSlug={slug} accent={MARKETPLACE.blue} ink={MARKETPLACE.ink} />
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

      {crumbs && (
        <div style={{ ...wrap, fontSize: 10, opacity: 0.65, padding: "14px 0 0" }}>{crumbs}</div>
      )}
    </>
  );
}

export function MarketplaceFooter({
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
  );
}
