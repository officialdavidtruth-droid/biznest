"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { LayoutGrid, List, Search, X } from "lucide-react";
import type { BuilderConfig } from "@/lib/builder-config";
import { getBusinessExperience } from "@/lib/business-experience";
import { useCart } from "@/lib/cart-context";
import { BuilderFooter, BuilderHeader, ItemCard } from "@/components/storefront/builder-renderer";

export type CatalogEntry = {
  id: string; kind: "product" | "service"; name: string; price: number; currency: string;
  image: string | null; categoryName: string | null;
  /** Products with sizes/colours must be chosen on their own page, so they cannot be quick-added. */
  hasVariants?: boolean;
  /** Extra text the search box matches against (e.g. the description). */
  searchText?: string;
};

type StoreInfo = {
  name: string; slug: string; logoUrl: string | null; contactEmail: string | null; contactPhone: string | null;
  business: { description: string | null; category?: string | null; businessSubcategory?: string | null; sellsProducts?: boolean; offersServices?: boolean };
};

type Sort = "featured" | "price-asc" | "price-desc" | "name";
const PAGE = 12;
const SORTS: { value: Sort; label: string }[] = [
  { value: "featured", label: "Featured" },
  { value: "price-asc", label: "Price: low to high" },
  { value: "price-desc", label: "Price: high to low" },
  { value: "name", label: "Name: A to Z" },
];

/**
 * The store's full catalogue. It reuses the store's own template chrome (header, footer, product card)
 * so it looks like part of the same site, then adds the tools a shopper needs: search, category chips,
 * a price ceiling, sorting, grid or list view and "show more".
 */
export function CatalogExperience({
  store, design: d, items, initialCategory, initialQuery, mode = "catalog", heading,
}: {
  store: StoreInfo; design: BuilderConfig["design"]; items: CatalogEntry[]; initialCategory?: string; initialQuery?: string;
  /** "category" pins the title to the category name; "search" turns the title into the live query. */
  mode?: "catalog" | "category" | "search"; heading?: string;
}) {
  const experience = getBusinessExperience(store.business.category, { sellsProducts: store.business.sellsProducts, offersServices: store.business.offersServices }, store.business.businessSubcategory);
  const isService = experience.mode === "service";
  const width = d.containerWidth === "compact" ? 960 : d.containerWidth === "wide" ? 1320 : 1160;
  const base = `/store/${store.slug}`;

  const categories = useMemo(() => {
    const counts = new Map<string, number>();
    for (const i of items) if (i.categoryName) counts.set(i.categoryName, (counts.get(i.categoryName) ?? 0) + 1);
    return Array.from(counts.entries()).sort((a, b) => b[1] - a[1]);
  }, [items]);
  const hasProducts = items.some((i) => i.kind === "product");
  const hasServices = items.some((i) => i.kind === "service");
  const prices = items.map((i) => i.price);
  const lowest = prices.length ? Math.min(...prices) : 0;
  const highest = prices.length ? Math.max(...prices) : 0;
  const currency = items[0]?.currency ?? "";

  const matchedCategory = categories.find(([name]) => name.toLowerCase() === (initialCategory ?? "").toLowerCase())?.[0] ?? null;
  const [q, setQ] = useState(initialQuery ?? "");
  const [cat, setCat] = useState<string | null>(matchedCategory);
  const [kind, setKind] = useState<"all" | "product" | "service">("all");
  const [sort, setSort] = useState<Sort>("featured");
  const [maxPrice, setMaxPrice] = useState<number | null>(null);
  const [view, setView] = useState<"grid" | "list">("grid");
  const [shown, setShown] = useState(PAGE);

  const priceLimited = maxPrice != null && maxPrice < highest;
  const hasFilters = !!q.trim() || !!cat || kind !== "all" || priceLimited;

  const results = useMemo(() => {
    const needle = q.trim().toLowerCase();
    let list = items.filter((i) =>
      (!cat || i.categoryName === cat) &&
      (kind === "all" || i.kind === kind) &&
      (maxPrice == null || i.price <= maxPrice) &&
      (!needle || i.name.toLowerCase().includes(needle) || (i.categoryName ?? "").toLowerCase().includes(needle) || (i.searchText ?? "").toLowerCase().includes(needle)));
    list = [...list];
    if (sort === "price-asc") list.sort((a, b) => a.price - b.price);
    else if (sort === "price-desc") list.sort((a, b) => b.price - a.price);
    else if (sort === "name") list.sort((a, b) => a.name.localeCompare(b.name));
    return list;
  }, [items, q, cat, kind, maxPrice, sort]);

  useEffect(() => { setShown(PAGE); }, [q, cat, kind, maxPrice, sort]);

  // Keep the address bar shareable: /catalog?category=Fashion&q=shoes
  useEffect(() => {
    try {
      const url = new URL(window.location.href);
      cat ? url.searchParams.set("category", cat) : url.searchParams.delete("category");
      q.trim() ? url.searchParams.set("q", q.trim()) : url.searchParams.delete("q");
      window.history.replaceState(null, "", url.toString());
    } catch { /* non-critical */ }
  }, [cat, q]);

  const pageTitle = mode === "search" ? (q.trim() ? `Results for “${q.trim()}”` : "Search") : mode === "category" && heading ? (cat ?? heading) : (cat ?? (isService ? "All services" : "All products"));

  function reset() { setQ(""); setCat(null); setKind("all"); setMaxPrice(null); }

  const title = isService ? "Services" : "Shop";
  const radius = d.radius;
  const line = `${d.text}1f`;
  const storeLinks = [
    { label: "Home", href: base },
    { label: title, href: `${base}/catalog` },
    ...(isService ? [] : [{ label: "Categories", href: `${base}/categories` }]),
    { label: "About", href: `${base}/about` },
    { label: "Contact", href: `${base}/contact` },
  ];
  const chip = (active: boolean): React.CSSProperties => ({
    flex: "0 0 auto", cursor: "pointer", fontSize: 13, fontWeight: 650, padding: "8px 15px", borderRadius: 999,
    border: `1px solid ${active ? d.primary : line}`, background: active ? d.primary : "transparent",
    color: active ? (d.primary.toLowerCase() === "#ffffff" ? d.text : "#fff") : d.text,
  });
  const control: React.CSSProperties = { background: d.surface, border: `1px solid ${line}`, color: d.text, borderRadius: Math.min(radius, 12), padding: "10px 12px", fontSize: 14, fontFamily: "inherit" };

  return (
    <main style={{ background: d.background, color: d.text, fontFamily: d.font, minHeight: "100vh" }}>
      <style>{`a{text-decoration:none;color:inherit}.bn-wrap{width:min(${width}px,calc(100% - 32px));margin:0 auto}.bn-grid{display:grid;gap:20px}
.cx-chips{display:flex;gap:8px;overflow-x:auto;padding:2px 0 6px;scrollbar-width:thin}
.cx-focus:focus-visible,.cx-chips button:focus-visible,.cx-row:focus-visible{outline:2px solid ${d.accent};outline-offset:2px}
@media(max-width:720px){.bn-nav-links{display:none!important}.cx-tools{flex-direction:column;align-items:stretch!important}.cx-row{grid-template-columns:84px 1fr!important}.cx-row>div:last-child{grid-column:1/-1}}`}</style>

      <BuilderHeader store={store} d={d} experience={experience} visible={[]} />

      {/* Title band */}
      <section style={{ background: d.surface, borderBottom: `1px solid ${line}` }}>
        <div className="bn-wrap" style={{ padding: "44px 0 34px" }}>
          <nav aria-label="Breadcrumb" style={{ fontSize: 13, color: d.muted, marginBottom: 14 }}>
            <Link href={base}>Home</Link> / {mode === "catalog" ? <span style={{ color: d.text }}>{title}</span> : <><Link href={`${base}/catalog`}>{title}</Link> / <span style={{ color: d.text }}>{mode === "search" ? "Search" : heading}</span></>}
          </nav>
          <h1 style={{ fontFamily: d.headingFont, fontSize: "clamp(34px,5vw,60px)", lineHeight: 1.03, letterSpacing: "-.035em", margin: 0 }}>{pageTitle}</h1>
          <p style={{ margin: "12px 0 0", color: d.muted, lineHeight: 1.6, maxWidth: 560 }}>
            {items.length === 0
              ? "Nothing has been published yet. Check back soon."
              : mode === "search" && q.trim()
                ? `${results.length} ${results.length === 1 ? "result" : "results"} found.`
                : `${items.length} ${items.length === 1 ? "item" : "items"} to browse${lowest > 0 ? `, starting from ${currency} ${lowest.toLocaleString()}` : ""}.`}
          </p>
        </div>
      </section>

      <div className="bn-wrap" style={{ padding: "28px 0 24px" }}>
        {/* Search, sort, view */}
        <div className="cx-tools" style={{ display: "flex", gap: 12, alignItems: "center", flexWrap: "wrap" }}>
          <label style={{ position: "relative", flex: "1 1 260px", maxWidth: 440 }}>
            <span className="sr-only" style={{ position: "absolute", width: 1, height: 1, overflow: "hidden", clip: "rect(0 0 0 0)" }}>Search {title.toLowerCase()}</span>
            <Search size={16} aria-hidden style={{ position: "absolute", left: 13, top: 13, color: d.muted }} />
            <input className="cx-focus" value={q} onChange={(e) => setQ(e.target.value)} placeholder={`Search ${isService ? "services" : "products"}`} style={{ ...control, width: "100%", paddingLeft: 38, paddingRight: q ? 38 : 12 }} />
            {q && <button type="button" aria-label="Clear search" onClick={() => setQ("")} style={{ position: "absolute", right: 8, top: 8, border: 0, background: "transparent", color: d.muted, cursor: "pointer", padding: 4 }}><X size={16} /></button>}
          </label>

          {hasProducts && hasServices && (
            <div role="group" aria-label="Type" style={{ display: "flex", gap: 6 }}>
              {(["all", "product", "service"] as const).map((k) => <button key={k} type="button" aria-pressed={kind === k} onClick={() => setKind(k)} style={chip(kind === k)}>{k === "all" ? "Everything" : k === "product" ? "Products" : "Services"}</button>)}
            </div>
          )}

          <div style={{ display: "flex", gap: 10, alignItems: "center", marginLeft: "auto" }}>
            <label style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 13, color: d.muted }}>Sort
              <select className="cx-focus" value={sort} onChange={(e) => setSort(e.target.value as Sort)} style={control}>{SORTS.map((s) => <option key={s.value} value={s.value}>{s.label}</option>)}</select>
            </label>
            <div role="group" aria-label="Layout" style={{ display: "flex", border: `1px solid ${line}`, borderRadius: Math.min(radius, 12), overflow: "hidden" }}>
              {([["grid", LayoutGrid], ["list", List]] as const).map(([v, Icon]) => (
                <button key={v} type="button" aria-label={`${v} view`} aria-pressed={view === v} onClick={() => setView(v)} style={{ border: 0, cursor: "pointer", padding: "10px 12px", background: view === v ? d.primary : "transparent", color: view === v ? "#fff" : d.text, display: "grid", placeItems: "center" }}><Icon size={16} /></button>
              ))}
            </div>
          </div>
        </div>

        {/* Categories */}
        {categories.length > 0 && (
          <div className="cx-chips" role="group" aria-label="Categories" style={{ marginTop: 18 }}>
            <button type="button" aria-pressed={!cat} onClick={() => setCat(null)} style={chip(!cat)}>All ({items.length})</button>
            {categories.map(([name, n]) => <button key={name} type="button" aria-pressed={cat === name} onClick={() => setCat(cat === name ? null : name)} style={chip(cat === name)}>{name} ({n})</button>)}
          </div>
        )}

        {/* Price ceiling + result summary */}
        <div style={{ display: "flex", flexWrap: "wrap", gap: 16, alignItems: "center", margin: "16px 0 26px", paddingTop: 16, borderTop: `1px solid ${line}`, fontSize: 13, color: d.muted }}>
          {highest > lowest && (
            <label style={{ display: "flex", alignItems: "center", gap: 10 }}>Up to
              <input className="cx-focus" type="range" min={lowest} max={highest} step={Math.max(1, Math.round((highest - lowest) / 100))} value={maxPrice ?? highest} onChange={(e) => setMaxPrice(Number(e.target.value))} style={{ accentColor: d.accent, width: 160 }} />
              <strong style={{ color: d.text, minWidth: 90 }}>{currency} {(maxPrice ?? highest).toLocaleString()}</strong>
            </label>
          )}
          <span aria-live="polite" style={{ marginLeft: "auto" }}>Showing {Math.min(shown, results.length)} of {results.length}</span>
          {hasFilters && <button type="button" onClick={reset} style={{ border: 0, background: "transparent", color: d.accent, fontWeight: 700, cursor: "pointer", fontSize: 13 }}>Clear filters</button>}
        </div>

        {/* Results */}
        {results.length === 0 ? (
          <div style={{ textAlign: "center", padding: "72px 16px", border: `1px dashed ${line}`, borderRadius: radius }}>
            <h2 style={{ fontFamily: d.headingFont, fontSize: 26, margin: 0 }}>{items.length === 0 ? "Nothing here yet" : "No matches"}</h2>
            <p style={{ color: d.muted, margin: "10px auto 20px", maxWidth: 380, lineHeight: 1.6 }}>{items.length === 0 ? "This store hasn't published anything yet." : "Try a different word, another category or a higher price limit."}</p>
            {hasFilters && <button type="button" onClick={reset} style={{ border: 0, cursor: "pointer", padding: "12px 22px", borderRadius: d.buttonStyle === "pill" ? 999 : Math.min(radius, 12), background: d.primary, color: "#fff", fontWeight: 800 }}>Show everything</button>}
          </div>
        ) : view === "grid" ? (
          <div className="bn-grid" style={{ gridTemplateColumns: "repeat(auto-fill, minmax(230px, 1fr))", gap: 24 }}>
            {results.slice(0, shown).map((item) => (
              <div key={`${item.kind}-${item.id}`}>
                <ItemCard item={item} store={store} d={d} radius={radius} actionLabel={item.kind === "service" ? experience.primaryAction : "View product"} />
                <QuickAdd item={item} slug={store.slug} base={base} d={d} radius={radius} serviceLabel={experience.primaryAction} />
              </div>
            ))}
          </div>
        ) : (
          <div style={{ display: "grid", gap: 12 }}>
            {results.slice(0, shown).map((item) => {
              const href = `${base}/${item.kind}/${item.id}`;
              return (
                <div key={`${item.kind}-${item.id}`} className="cx-row" style={{ display: "grid", gridTemplateColumns: "128px 1fr auto", gap: 18, alignItems: "center", padding: 12, background: d.surface, border: `1px solid ${line}`, borderRadius: radius }}>
                  <Link href={href} aria-label={item.name} style={{ aspectRatio: "1/1", borderRadius: Math.max(radius - 4, 4), background: item.image ? `url(${item.image}) center/cover` : `${d.primary}12` }} />
                  <Link href={href}>
                    {item.categoryName && <div style={{ fontSize: 12, color: d.muted, marginBottom: 4 }}>{item.categoryName}</div>}
                    <div style={{ fontWeight: 750, fontSize: 17, fontFamily: d.headingFont }}>{item.name}</div>
                    <div style={{ fontWeight: 800, color: d.accent, marginTop: 6 }}>{item.currency} {item.price.toLocaleString()}</div>
                  </Link>
                  <div style={{ minWidth: 150 }}><QuickAdd item={item} slug={store.slug} base={base} d={d} radius={radius} serviceLabel={experience.primaryAction} /></div>
                </div>
              );
            })}
          </div>
        )}

        {results.length > shown && (
          <div style={{ textAlign: "center", marginTop: 40 }}>
            <button type="button" onClick={() => setShown((n) => n + PAGE)} style={{ cursor: "pointer", padding: "13px 30px", borderRadius: d.buttonStyle === "pill" ? 999 : Math.min(radius, 12), border: `1px solid ${d.text}`, background: "transparent", color: d.text, fontWeight: 800, fontSize: 14 }}>
              Show {Math.min(PAGE, results.length - shown)} more
            </button>
          </div>
        )}
      </div>

      <BuilderFooter store={store} d={d} visible={[]} storeLinks={storeLinks} />
    </main>
  );
}

/** Add-to-cart under each card. Products with options and all services go to their own page instead. */
function QuickAdd({ item, slug, base, d, radius, serviceLabel }: { item: CatalogEntry; slug: string; base: string; d: BuilderConfig["design"]; radius: number; serviceLabel: string }) {
  const { addItem } = useCart();
  const [added, setAdded] = useState(false);
  useEffect(() => {
    if (!added) return;
    const id = window.setTimeout(() => setAdded(false), 1800);
    return () => window.clearTimeout(id);
  }, [added]);

  const shape: React.CSSProperties = { display: "block", width: "100%", textAlign: "center", marginTop: 10, padding: "11px 14px", borderRadius: d.buttonStyle === "pill" ? 999 : Math.min(radius, 12), fontWeight: 800, fontSize: 13, cursor: "pointer", fontFamily: "inherit" };
  const outline: React.CSSProperties = { ...shape, border: `1px solid ${d.text}33`, background: "transparent", color: d.text };

  if (item.kind === "service") return <Link href={`${base}/service/${item.id}`} style={outline}>{serviceLabel}</Link>;
  if (item.hasVariants) return <Link href={`${base}/product/${item.id}`} style={outline}>Choose options</Link>;
  return (
    <button type="button" aria-live="polite" style={{ ...shape, border: 0, background: d.primary, color: "#fff" }}
      onClick={() => { addItem(slug, { productId: item.id, name: item.name, price: item.price, currency: item.currency, image: item.image }); setAdded(true); }}>
      {added ? "Added to cart" : "Add to cart"}
    </button>
  );
}
