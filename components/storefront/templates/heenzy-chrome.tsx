import type React from "react";
import { HEENZY } from "@/lib/template-themes";
import { CategoryNav } from "@/components/storefront/category-nav";
import { HeenzyNav } from "@/components/storefront/templates/heenzy-home";
import type { CategoryTreeNode } from "@/lib/storefront-categories";

// Shared header + footer for the Heenzy template, extracted from
// heenzy-home.tsx (HeenzyNav is exported from there and reused here as-is)
// so every page of a Heenzy-templated store (product, category, catalog,
// search) shares the exact same nav / category strip / footer as the
// homepage and its already-finished cart/checkout pages, instead of
// falling back to the generic bar the remaining unfinished templates use
// (same fix already applied to Violet, Marketplace Hub, Arcova, Nova, and
// Premium Marketplace).

export const wrap: React.CSSProperties = { maxWidth: 1320, margin: "0 auto", padding: "0 24px" };

type ChromeStore = {
  name: string;
  logoUrl: string | null;
  contactEmail: string | null;
  contactPhone: string | null;
  business: { description: string | null };
};

export function HeenzyHeader({
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
    <div className="hz-root">
      <HeenzyNav store={store} slug={slug} hasCatalog />
      <CategoryNav slug={slug} categories={navCategories} accent={HEENZY.black} ink={HEENZY.black} bg="#fff" border="#e7e7e7" />
      {crumbs && (
        <div style={{ ...wrap, fontSize: 12.5, color: HEENZY.gray, padding: "20px 24px 0" }}>{crumbs}</div>
      )}
    </div>
  );
}

export function HeenzyFooter({
  store,
  slug,
  navCategories,
}: {
  store: ChromeStore;
  slug: string;
  navCategories: CategoryTreeNode[];
}) {
  return (
    <footer className="hz-footer">
      <div className="hz-wrap">
        <div className="hz-footer-grid">
          <div>
            <div className="hz-logo" style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 10 }}>
              {store.logoUrl ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={store.logoUrl} alt={store.name} style={{ height: 26, width: 26, borderRadius: 6, objectFit: "cover" }} />
              ) : null}
              {store.name}
            </div>
            {store.business.description && <p style={{ fontSize: 13, color: HEENZY.gray, lineHeight: 1.6, maxWidth: 240 }}>{store.business.description.slice(0, 130)}</p>}
          </div>
          <div>
            <h4>Shop</h4>
            <ul>
              {navCategories.slice(0, 4).map((c) => <li key={c.id}><a href={`/${slug}/category/${c.id}`}>{c.name}</a></li>)}
            </ul>
          </div>
          <div>
            <h4>Help</h4>
            <ul><li><a href={`/${slug}/cart`}>Cart</a></li><li><a href={`/${slug}/catalog`}>Shop</a></li></ul>
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
  );
}
