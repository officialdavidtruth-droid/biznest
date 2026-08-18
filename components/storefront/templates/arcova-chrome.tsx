import type React from "react";
import { CartLink } from "@/components/storefront/cart-link";
import { ARCOVA } from "@/lib/template-themes";
import { CategoryNav } from "@/components/storefront/category-nav";
import type { CategoryTreeNode } from "@/lib/storefront-categories";

// Shared header + footer for the Arcova template, extracted from
// arcova-home.tsx so every page of an Arcova-templated store (product,
// category, catalog, search, cart, checkout, confirmation) shares the exact
// same dark editorial nav / uppercase letter-spaced links / footer as the
// homepage, instead of each page inventing its own generic bar (same fix
// already applied to Violet and Marketplace Hub).

export const wrap: React.CSSProperties = { width: "88%", maxWidth: 1180, margin: "0 auto" };

type ChromeStore = {
  name: string;
  logoUrl: string | null;
  contactEmail: string | null;
  contactPhone: string | null;
  business: { description: string | null };
};

export function ArcovaHeader({
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
      {/* ---------- NAV ---------- */}
      <header style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "22px 0", borderBottom: `1px solid ${ARCOVA.border}` }}>
        <div style={wrap}>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
            <a href={`/${slug}`} style={{ textDecoration: "none", color: ARCOVA.ink, display: "flex", alignItems: "center", gap: 10 }}>
              {store.logoUrl ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={store.logoUrl} alt={store.name} style={{ height: 32, width: "auto" }} />
              ) : null}
              <span style={{ fontSize: 18, fontWeight: 700, letterSpacing: 1 }}>{store.name.toUpperCase()}</span>
            </a>
            <nav style={{ display: "flex", alignItems: "center", gap: 26, fontSize: 12, letterSpacing: 1 }}>
              <a href={`/${slug}/catalog`} style={{ color: ARCOVA.ink, textDecoration: "none" }}>PROJECTS</a>
              {store.business.description && <a href={`/${slug}#services`} style={{ color: ARCOVA.ink, textDecoration: "none" }}>SERVICES</a>}
              {(store.contactEmail || store.contactPhone) && <a href={`/${slug}#contact`} style={{ color: ARCOVA.ink, textDecoration: "none" }}>CONTACT</a>}
              <CartLink storeSlug={slug} accent={ARCOVA.accent} onAccent="#ffffff" ink={ARCOVA.ink} />
            </nav>
          </div>
        </div>
      </header>

      <CategoryNav slug={slug} categories={navCategories} accent={ARCOVA.accent} ink={ARCOVA.ink} bg="transparent" border={ARCOVA.border} />

      {crumbs && (
        <div style={{ ...wrap, fontSize: 12, opacity: 0.6, padding: "18px 0 0" }}>{crumbs}</div>
      )}
    </>
  );
}

export function ArcovaFooter({
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
      {/* ---------- CTA / CONTACT ---------- */}
      <section id="contact" style={{ padding: "70px 0", background: ARCOVA.dark, color: "#fff" }}>
        <div style={{ ...wrap, display: "grid", gridTemplateColumns: "1fr 1fr", gap: 40 }}>
          <div>
            <h2 style={{ fontSize: 30, fontWeight: 700, lineHeight: 1.15, margin: "0 0 20px" }}>
              Let&apos;s build something<br />extraordinary
            </h2>
          </div>
          <div style={{ fontSize: 14, lineHeight: 2 }}>
            <div style={{ fontSize: 11, letterSpacing: 2, color: ARCOVA.accent, marginBottom: 10 }}>CONTACT</div>
            {store.contactEmail && <p style={{ margin: 0 }}>&#9993; {store.contactEmail}</p>}
            {store.contactPhone && <p style={{ margin: 0 }}>&#9742; {store.contactPhone}</p>}
            {Object.keys(social).length > 0 && (
              <p style={{ margin: "10px 0 0", opacity: 0.7 }}>
                {Object.entries(social).map(([k, v]) => (
                  <a key={k} href={v} style={{ color: "#fff", marginRight: 14, textDecoration: "underline" }}>{k}</a>
                ))}
              </p>
            )}
          </div>
        </div>
      </section>

      {/* ---------- FOOTER ---------- */}
      <footer style={{ padding: "28px 0", borderTop: `1px solid ${ARCOVA.border}`, fontSize: 12, opacity: 0.7 }}>
        <div style={{ ...wrap, display: "flex", justifyContent: "space-between", flexWrap: "wrap", gap: 10 }}>
          <span>{store.name}</span>
          <span>&copy; {new Date().getFullYear()}</span>
        </div>
      </footer>
    </>
  );
}
