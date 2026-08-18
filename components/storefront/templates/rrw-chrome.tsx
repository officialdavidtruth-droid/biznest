import type React from "react";
import { CartLink } from "@/components/storefront/cart-link";
import { RRW } from "@/lib/template-themes";
import { CategoryNav } from "@/components/storefront/category-nav";
import type { CategoryTreeNode } from "@/lib/storefront-categories";
import { subscribeToNewsletter } from "@/lib/actions/newsletter";

// Shared header + footer for the rRW template, extracted from
// rrw-home.tsx so every page of an rRW-templated store (product,
// category, catalog, search, cart, checkout) shares the exact same
// floating pill nav / dark benefits-strip footer as the homepage,
// instead of each page falling back to the generic default bar (same fix
// already applied to Violet, Marketplace Hub, Arcova, Nova, Premium, and
// HomeVista).
//
// The homepage's pill nav floats over a full-bleed hero image, which
// doesn't exist on inner pages — here it's pinned to a plain header bar
// instead so the pill shape and nav links still read as "the same site"
// without needing a hero behind them.

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

export function RrwHeader({
  store,
  slug,
  navCategories,
  crumbs,
}: {
  store: ChromeStore;
  slug: string;
  navCategories: CategoryTreeNode[];
  /** Optional breadcrumb trail rendered just under the nav, e.g. Home / Category / Product */
  crumbs?: React.ReactNode;
}) {
  return (
    <>
      {/* ---------- NAV ---------- */}
      <div style={{ padding: "15px 6%", background: "#0e1115" }}>
        <header
          style={{
            height: 45, background: "#fff", borderRadius: 25, display: "flex",
            alignItems: "center", padding: "0 18px", boxShadow: "0 4px 20px #00000012",
          }}
        >
          <a href={`/${slug}`} style={{ fontWeight: 900, fontSize: 20, letterSpacing: "-2px", textDecoration: "none", color: RRW.ink, display: "flex", alignItems: "center", gap: 8 }}>
            {store.logoUrl ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={store.logoUrl} alt={store.name} style={{ height: 26, width: 26, borderRadius: "50%", objectFit: "cover" }} />
            ) : null}
            {store.name}
          </a>
          <nav style={{ display: "flex", gap: 28, margin: "0 auto", fontSize: 10 }}>
            <a href={`/${slug}#fleet`} style={{ textDecoration: "none", color: RRW.ink }}>Fleet</a>
            {navCategories.length > 0 && <a href={`/${slug}/catalog`} style={{ textDecoration: "none", color: RRW.ink }}>Categories</a>}
          </nav>
          <div style={{ display: "flex", gap: 10, alignItems: "center" }}>
            <CartLink storeSlug={slug} accent={RRW.accent} ink={RRW.ink} />
          </div>
        </header>
      </div>

      <CategoryNav slug={slug} categories={navCategories} accent={RRW.accent} ink={RRW.ink} bg="#fff" border="#ddd" />

      {crumbs && (
        <div style={{ ...wrap, fontSize: 11, opacity: 0.6, padding: "18px 6% 0" }}>{crumbs}</div>
      )}
    </>
  );
}

export function RrwFooter({
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
      {/* ---------- BENEFITS ---------- */}
      <section style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", background: "#080a0d", color: "#fff", padding: "28px 6%", gap: 15, marginTop: 30 }}>
        {[["♧", "Seamless booking"], ["♢", "Premium privileges for regular customers"], ["⚙", "Change or cancel up to 72h"], ["№", "No hidden fees"]].map((x) => (
          <div key={x[1]} style={{ display: "flex", gap: 12, alignItems: "center", borderRight: "1px solid #292b2e", fontSize: 23 }}>
            {x[0]}<span style={{ fontSize: 8, color: "#ddd" }}>{x[1]}</span>
          </div>
        ))}
      </section>

      {/* ---------- FOOTER ---------- */}
      <footer style={{ padding: "32px 6% 10px", display: "grid", gridTemplateColumns: "1.5fr 1fr 1fr 1fr", gap: 30, fontSize: 8, color: "#666" }}>
        <div>
          <h4 style={{ margin: "0 0 12px", color: "#111" }}>{store.name}</h4>
          <p>{store.business.description || "Premium rental, made simple."}</p>
          <form action={subscribeNewsletter} style={{ display: "flex", border: "1px solid #ddd", borderRadius: 18, overflow: "hidden", width: 160, marginTop: 10 }}>
            <input type="hidden" name="slug" value={slug} />
            <input name="email" type="email" required placeholder="Email" style={{ border: 0, padding: 8, outline: 0, width: 130, fontSize: 8 }} />
            <button type="submit" style={{ border: 0, background: "#111", color: "#fff", width: 30, cursor: "pointer" }}>→</button>
          </form>
        </div>
        <div>
          <h4 style={{ margin: "0 0 12px", color: "#111" }}>Links</h4>
          <a href={`/${slug}/catalog`} style={{ display: "block", margin: "8px 0" }}>Fleet</a>
          <a href={`/${slug}/cart`} style={{ display: "block", margin: "8px 0" }}>Cart</a>
        </div>
        <div>
          <h4 style={{ margin: "0 0 12px", color: "#111" }}>Contact</h4>
          {store.contactEmail && <a style={{ display: "block", margin: "8px 0" }}>{store.contactEmail}</a>}
          {store.contactPhone && <a style={{ display: "block", margin: "8px 0" }}>{store.contactPhone}</a>}
        </div>
        <div>
          <h4 style={{ margin: "0 0 12px", color: "#111" }}>Follow</h4>
          {Object.entries(social).map(([k, v]) => (
            <a key={k} href={v} style={{ display: "block", margin: "8px 0" }}>{k}</a>
          ))}
        </div>
        <div style={{ gridColumn: "1/-1", borderTop: "1px solid #eee", paddingTop: 12, color: "#999" }}>© {new Date().getFullYear()} {store.name}. All rights reserved.</div>
      </footer>
    </>
  );
}
