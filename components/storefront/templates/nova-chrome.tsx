import type React from "react";
import { CartLink } from "@/components/storefront/cart-link";
import { NOVA } from "@/lib/template-themes";
import { CategoryNav } from "@/components/storefront/category-nav";
import type { CategoryTreeNode } from "@/lib/storefront-categories";

// Shared header + footer for the Nova Studio template, extracted from
// nova-home.tsx so every page of a Nova-templated store (product, category,
// catalog, search, cart, checkout, confirmation) shares the exact same dark
// editorial nav / serif display type / footer as the homepage, instead of
// falling back to the generic bar every other unfinished template used
// (same fix already applied to Violet, Marketplace Hub, and Arcova).

export const wrap: React.CSSProperties = { maxWidth: 1320, margin: "0 auto", padding: "0 60px" };
export const serif: React.CSSProperties = { fontFamily: NOVA.headlineFont };
export const label: React.CSSProperties = { fontFamily: "monospace", fontSize: 11, letterSpacing: "0.22em", textTransform: "uppercase", color: NOVA.gold };

type ChromeStore = {
  name: string;
  logoUrl: string | null;
  contactEmail: string | null;
  contactPhone: string | null;
  business: { description: string | null };
};

export function NovaHeader({
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
      {/* ---------- SIDE-RAIL-STYLE STICKY NAV (not a top bar) ---------- */}
      <div style={{ position: "sticky", top: 0, zIndex: 50, display: "flex", alignItems: "center", justifyContent: "space-between", padding: "26px 60px", borderBottom: `1px solid ${NOVA.line}`, background: "rgba(10,10,12,.88)", backdropFilter: "blur(10px)" }}>
        <a href={`/store/${slug}`} style={{ ...serif, fontSize: 22, fontWeight: 700, color: NOVA.cream, textDecoration: "none", letterSpacing: "0.02em", display: "flex", alignItems: "center" }}>
          {store.logoUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={store.logoUrl} alt={store.name} style={{ height: 30, width: 30, borderRadius: "50%", objectFit: "cover", marginRight: 10, verticalAlign: "middle" }} />
          ) : null}
          {store.name}
        </a>
        <div style={{ display: "flex", alignItems: "center", gap: 26 }}>
          <a href={`/store/${slug}/catalog`} style={{ ...label, textDecoration: "none" }}>The Collection</a>
          <a href={`/store/${slug}/search`} style={{ ...label, textDecoration: "none" }}>Search</a>
          <CartLink storeSlug={slug} accent={NOVA.gold} ink={NOVA.cream} />
        </div>
      </div>

      <CategoryNav slug={slug} categories={navCategories} accent={NOVA.gold} ink={NOVA.cream} bg={NOVA.black} border={NOVA.line} />

      {crumbs && (
        <div style={{ ...wrap, fontSize: 12, color: NOVA.gray, padding: "22px 60px 0" }}>{crumbs}</div>
      )}
    </>
  );
}

export function NovaFooter({
  store,
  slug,
  social,
}: {
  store: ChromeStore;
  slug: string;
  social: Record<string, string>;
}) {
  return (
    <footer style={{ padding: "70px 0 50px", borderTop: `1px solid ${NOVA.line}`, marginTop: 60 }}>
      <div style={{ ...wrap, display: "flex", justifyContent: "space-between", flexWrap: "wrap", gap: 30 }}>
        <div>
          <div style={{ ...serif, fontSize: 20, fontWeight: 700, color: NOVA.cream }}>{store.name}</div>
          {store.business.description && (
            <p style={{ marginTop: 10, fontSize: 13, color: NOVA.gray, maxWidth: 320 }}>{store.business.description}</p>
          )}
        </div>
        <div style={{ display: "flex", flexDirection: "column", gap: 10, fontSize: 13 }}>
          {social.whatsapp && <a href={`https://wa.me/${social.whatsapp}`} style={{ color: NOVA.cream, textDecoration: "none" }}>WhatsApp</a>}
          {store.contactPhone && <a href={`tel:${store.contactPhone}`} style={{ color: NOVA.cream, textDecoration: "none" }}>{store.contactPhone}</a>}
          {store.contactEmail && <a href={`mailto:${store.contactEmail}`} style={{ color: NOVA.cream, textDecoration: "none" }}>{store.contactEmail}</a>}
        </div>
      </div>
    </footer>
  );
}
