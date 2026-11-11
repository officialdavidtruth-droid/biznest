"use client";

import { GRID_GAP, GRID_MIN, type PageSkin } from "@/lib/storefront/page-skin";
import { useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import Link from "next/link";
import { ArrowRight, ChevronDown, ChevronRight, Compass, LayoutGrid, List, MessageCircle, Search, SlidersHorizontal, X } from "lucide-react";
import { useStoreCategories } from "@/components/storefront/store-categories";
import type { BuilderConfig } from "@/lib/builder-config";
import { getBusinessExperience } from "@/lib/business-experience";
import { useCart } from "@/lib/cart-context";
import { BuilderFooter, BuilderHeader, ItemCard } from "@/components/storefront/builder-renderer";
import { formatNumber } from "@/lib/i18n/locale";
import { readableOn } from "@/lib/storefront/readable-design";

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
  store, design: d, items, initialCategory, initialQuery, mode = "catalog", heading, topSlot, bottomSlot, externalChrome, skin,
}: {
  /** Per-template page recipe (title band, grid density, card look). */
  skin?: PageSkin;
  /** The page already sits inside the template's own header and footer (TemplateShell), so skip the Builder's. */
  externalChrome?: boolean;
  /** Owner blocks above and below the product grid (Customize > Pages > Shop page). */
  topSlot?: ReactNode; bottomSlot?: ReactNode;
  store: StoreInfo; design: BuilderConfig["design"]; items: CatalogEntry[]; initialCategory?: string; initialQuery?: string;
  /** "category" pins the title to the category name; "search" turns the title into the live query. */
  mode?: "catalog" | "category" | "search"; heading?: string;
}) {
  const experience = getBusinessExperience(store.business.category, { sellsProducts: store.business.sellsProducts, offersServices: store.business.offersServices }, store.business.businessSubcategory);
  const isService = experience.mode === "service";
  const hdr = skin?.header ?? "line";
  const centred = hdr === "centre";
  const solidBand = hdr === "band";
  const bandFg = solidBand ? readableOn(d.primary) : d.text;
  const bandMuted = solidBand ? `${readableOn(d.primary)}cc` : d.muted;
  const titleWeight = skin?.weight === "light" ? 300 : skin?.weight === "medium" ? 600 : 800;
  const gridMin = GRID_MIN[skin?.grid ?? "regular"];
  const gridGap = GRID_GAP[skin?.grid ?? "regular"];
  const cardFx: React.CSSProperties =
    skin?.cards === "framed" ? { border: `1px solid ${d.text}22`, padding: 10, borderRadius: Math.min(d.radius + 4, 22) }
    : skin?.cards === "lifted" ? { boxShadow: "0 14px 34px -14px rgba(0,0,0,.28)", padding: 10, borderRadius: Math.min(d.radius + 4, 22), background: d.surface }
    : skin?.cards === "tinted" ? { background: `${d.primary}12`, padding: 10, borderRadius: Math.min(d.radius + 4, 22) }
    : {};
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

  const [filterOpen, setFilterOpen] = useState(false);
  const filterRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!filterOpen) return;
    const onDown = (e: MouseEvent) => { if (filterRef.current && !filterRef.current.contains(e.target as Node)) setFilterOpen(false); };
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") setFilterOpen(false); };
    document.addEventListener("mousedown", onDown);
    document.addEventListener("keydown", onKey);
    return () => { document.removeEventListener("mousedown", onDown); document.removeEventListener("keydown", onKey); };
  }, [filterOpen]);
  const activeCount = (cat ? 1 : 0) + (kind !== "all" ? 1 : 0) + (priceLimited ? 1 : 0);

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
    color: active ? readableOn(d.primary) : d.text,
  });
  const control: React.CSSProperties = { boxSizing: "border-box", background: d.background, border: `1px solid ${line}`, color: d.text, borderRadius: Math.min(radius, 12), padding: "10px 12px", fontSize: 14, fontFamily: "inherit" };

  return (
    <main style={{ background: d.background, color: d.text, fontFamily: d.font, minHeight: externalChrome ? undefined : "100vh" }}>
      <style>{`a{text-decoration:none;color:inherit}.bn-wrap{width:min(${width}px,calc(100% - 32px));margin:0 auto}.bn-grid{display:grid;gap:20px}
.cx-card{transition:transform .22s ease,filter .22s ease}.cx-card:hover{transform:translateY(-4px);filter:drop-shadow(0 14px 22px rgba(0,0,0,.10))}@media(prefers-reduced-motion:reduce){.cx-card{transition:none}.cx-card:hover{transform:none}}
@media(max-width:600px){.cx-products{grid-template-columns:repeat(2,minmax(0,1fr))!important;gap:12px!important}}
.cx-chips{display:flex;gap:8px;overflow-x:auto;padding:2px 0 6px;scrollbar-width:thin}
.cx-focus:focus-visible,.cx-chips button:focus-visible,.cx-row:focus-visible{outline:2px solid ${d.accent};outline-offset:2px}
@media(max-width:720px){.cx-filterwrap{position:static!important}.cx-drop{left:0!important;right:0!important;width:auto!important}.cx-empty{grid-template-columns:1fr!important}.cx-art{display:none}.bn-nav-links{display:none!important}.cx-tools{flex-direction:column;align-items:stretch!important}.cx-search{flex:0 0 auto!important;max-width:none!important;width:100%}.cx-filterbtn{width:100%;justify-content:center}.cx-right{margin-left:0!important;justify-content:space-between}.cx-row{grid-template-columns:84px 1fr!important}.cx-row>div:last-child{grid-column:1/-1}}`}</style>

      {!externalChrome && <BuilderHeader store={store} d={d} experience={experience} visible={[]} />}
      {topSlot}

      {/* Title band */}
      <section style={{ position: "relative", overflow: "hidden", background: solidBand ? d.primary : hdr === "plain" || hdr === "split" ? d.surface : `linear-gradient(120deg, ${d.primary}1a 0%, ${d.accent}14 55%, ${d.surface} 100%), ${d.surface}`, borderBottom: hdr === "split" ? `4px solid ${d.accent}` : `1px solid ${line}`, textAlign: centred ? "center" : undefined }}>
        {(hdr === "line" || hdr === "centre") && <span aria-hidden style={{ position: "absolute", right: -80, top: -120, width: 360, height: 360, borderRadius: "50%", background: `radial-gradient(circle at 30% 30%, ${d.accent}30, transparent 70%)` }} />}
        {(hdr === "line" || hdr === "centre") && <span aria-hidden style={{ position: "absolute", right: 140, bottom: -150, width: 260, height: 260, borderRadius: "50%", background: `radial-gradient(circle at 40% 40%, ${d.primary}22, transparent 70%)` }} />}
        <div className="bn-wrap cx-band" style={{ position: "relative", padding: hdr === "plain" ? "72px 0 56px" : hdr === "split" ? "28px 0 26px" : "44px 0 40px" }}>
          <nav aria-label="Breadcrumb" style={{ fontSize: 13, color: d.muted, marginBottom: 22, display: "inline-flex", alignItems: "center", flexWrap: "wrap", gap: 6, padding: "6px 14px", borderRadius: 999, background: `${d.surface}cc`, border: `1px solid ${line}` }}>
            <Link href={base} style={{ fontWeight: 600 }}>Home</Link><ChevronRight size={14} aria-hidden />
            {mode === "catalog" ? <span style={{ color: d.text, fontWeight: 700 }}>{title}</span> : <><Link href={`${base}/catalog`} style={{ fontWeight: 600 }}>{title}</Link><ChevronRight size={14} aria-hidden /><span style={{ color: d.text, fontWeight: 700 }}>{mode === "search" ? "Search" : heading}</span></>}
          </nav>
          <div style={{ display: "flex", alignItems: "center", justifyContent: centred ? "center" : undefined, gap: 10, fontSize: 12, fontWeight: 800, letterSpacing: ".16em", textTransform: "uppercase", color: solidBand ? bandFg : d.accent, marginBottom: 12 }}>
            <span aria-hidden style={{ width: 28, height: 2, background: d.accent, borderRadius: 2 }} />
            {mode === "search" ? "Search" : mode === "category" ? "Category" : isService ? "Our services" : "The collection"}
          </div>
          <h1 style={{ fontFamily: d.headingFont, fontSize: "clamp(34px,5.4vw,60px)", lineHeight: 1.05, letterSpacing: titleWeight === 300 ? "0" : "-.035em", fontWeight: titleWeight, margin: centred ? "0 auto" : 0, color: bandFg, maxWidth: 900 }}>{pageTitle}</h1>
          <p style={{ margin: centred ? "14px auto 0" : "14px 0 0", color: bandMuted, fontSize: 17, lineHeight: 1.6, maxWidth: 620 }}>
            {items.length === 0
              ? mode === "category" ? `No listings in ${heading ?? "this category"} yet.` : "New items are on the way."
              : mode === "search" && q.trim()
                ? `${results.length} ${results.length === 1 ? "result" : "results"} found.`
                : mode === "category" ? `Browse everything in ${heading ?? "this category"}.` : `Browse the full ${isService ? "list of services" : "collection"} from ${store.name}.`}
          </p>
        </div>
      </section>

      <div className="bn-wrap" style={{ padding: "28px 0 24px" }}>
        {items.length > 0 && <div className="cx-bar" style={{ position: "relative", marginBottom: 26 }}>
        <div className="cx-tools" style={{ display: "flex", gap: 12, alignItems: "center", flexWrap: "wrap" }}>
          <label className="cx-search" style={{ position: "relative", flex: "1 1 260px", maxWidth: 440 }}>
            <span className="sr-only" style={{ position: "absolute", width: 1, height: 1, overflow: "hidden", clip: "rect(0 0 0 0)" }}>Search {title.toLowerCase()}</span>
            <Search size={16} aria-hidden style={{ position: "absolute", left: 13, top: 13, color: d.muted }} />
            <input className="cx-focus" value={q} onChange={(e) => setQ(e.target.value)} placeholder={`Search ${isService ? "services" : "products"}`} style={{ ...control, width: "100%", paddingLeft: 38, paddingRight: q ? 38 : 12 }} />
            {q && <button type="button" aria-label="Clear search" onClick={() => setQ("")} style={{ position: "absolute", right: 8, top: 8, border: 0, background: "transparent", color: d.muted, cursor: "pointer", padding: 4 }}><X size={16} /></button>}
          </label>

          {/* Filter button + dropdown */}
          <div ref={filterRef} className="cx-filterwrap" style={{ position: "relative" }}>
            <button type="button" className="cx-focus cx-filterbtn" aria-haspopup="dialog" aria-expanded={filterOpen} onClick={() => setFilterOpen((o) => !o)}
              style={{ ...control, display: "inline-flex", alignItems: "center", gap: 8, cursor: "pointer", fontWeight: 700, borderColor: filterOpen || activeCount ? d.primary : undefined }}>
              <SlidersHorizontal size={16} aria-hidden /> Filter
              {activeCount > 0 && <span style={{ minWidth: 20, height: 20, padding: "0 6px", borderRadius: 999, background: d.primary, color: readableOn(d.primary), fontSize: 11, fontWeight: 800, display: "grid", placeItems: "center" }}>{activeCount}</span>}
              <ChevronDown size={16} aria-hidden style={{ transition: "transform .18s", transform: filterOpen ? "rotate(180deg)" : "none" }} />
            </button>
            {filterOpen && (
              <div role="dialog" aria-label="Filter" className="cx-drop" style={{ position: "absolute", zIndex: 40, top: "calc(100% + 8px)", left: 0, width: "min(380px, calc(100vw - 32px))", background: d.surface, border: `1px solid ${line}`, borderRadius: Math.max(Math.min(radius, 16), 10), boxShadow: `0 24px 60px ${d.text}26`, padding: 18, display: "grid", gap: 18 }}>
                {categories.length > 0 && (
                  <fieldset style={{ border: 0, padding: 0, margin: 0 }}>
                    <legend style={{ fontSize: 12, fontWeight: 800, letterSpacing: ".08em", textTransform: "uppercase", color: d.muted, marginBottom: 10, padding: 0 }}>Category</legend>
                    <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
                      <button type="button" aria-pressed={!cat} onClick={() => setCat(null)} style={chip(!cat)}>All ({items.length})</button>
                      {categories.map(([name, n]) => <button key={name} type="button" aria-pressed={cat === name} onClick={() => setCat(cat === name ? null : name)} style={chip(cat === name)}>{name} ({n})</button>)}
                    </div>
                  </fieldset>
                )}
                {hasProducts && hasServices && (
                  <fieldset style={{ border: 0, padding: 0, margin: 0 }}>
                    <legend style={{ fontSize: 12, fontWeight: 800, letterSpacing: ".08em", textTransform: "uppercase", color: d.muted, marginBottom: 10, padding: 0 }}>Type</legend>
                    <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
                      {(["all", "product", "service"] as const).map((k) => <button key={k} type="button" aria-pressed={kind === k} onClick={() => setKind(k)} style={chip(kind === k)}>{k === "all" ? "Everything" : k === "product" ? "Products" : "Services"}</button>)}
                    </div>
                  </fieldset>
                )}
                {highest > lowest && (
                  <div>
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", marginBottom: 10 }}>
                      <span style={{ fontSize: 12, fontWeight: 800, letterSpacing: ".08em", textTransform: "uppercase", color: d.muted }}>Max price</span>
                      <strong style={{ color: d.text, fontSize: 14 }}>{currency} {formatNumber(maxPrice ?? highest)}</strong>
                    </div>
                    <input aria-label="Maximum price" className="cx-focus" type="range" min={lowest} max={highest} step={Math.max(1, Math.round((highest - lowest) / 100))} value={maxPrice ?? highest} onChange={(e) => setMaxPrice(Number(e.target.value))} style={{ accentColor: d.accent, width: "100%" }} />
                    <div style={{ display: "flex", justifyContent: "space-between", fontSize: 12, color: d.muted, marginTop: 4 }}><span>{currency} {formatNumber(lowest)}</span><span>{currency} {formatNumber(highest)}</span></div>
                  </div>
                )}
                <div style={{ display: "flex", gap: 10, alignItems: "center", paddingTop: 14, borderTop: `1px solid ${line}` }}>
                  <button type="button" onClick={reset} disabled={!hasFilters} style={{ border: 0, background: "transparent", color: hasFilters ? d.accent : d.muted, fontWeight: 700, cursor: hasFilters ? "pointer" : "default", fontSize: 13, padding: "8px 4px" }}>Clear all</button>
                  <button type="button" onClick={() => setFilterOpen(false)} style={{ marginLeft: "auto", border: 0, cursor: "pointer", padding: "11px 20px", borderRadius: d.buttonStyle === "pill" ? 999 : Math.min(radius, 12), background: d.primary, color: readableOn(d.primary), fontWeight: 800, fontSize: 14 }}>Show {results.length} {results.length === 1 ? "result" : "results"}</button>
                </div>
              </div>
            )}
          </div>

          <div className="cx-right" style={{ display: "flex", gap: 10, alignItems: "center", marginLeft: "auto" }}>
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

        {/* Applied filters + count */}
        <div style={{ display: "flex", flexWrap: "wrap", gap: 8, alignItems: "center", marginTop: 14, fontSize: 13, color: d.muted }}>
          {cat && <Applied label={cat} onRemove={() => setCat(null)} d={d} line={line} />}
          {kind !== "all" && <Applied label={kind === "product" ? "Products" : "Services"} onRemove={() => setKind("all")} d={d} line={line} />}
          {priceLimited && <Applied label={`Up to ${currency} ${formatNumber(maxPrice as number)}`} onRemove={() => setMaxPrice(null)} d={d} line={line} />}
          {hasFilters && <button type="button" onClick={reset} style={{ border: 0, background: "transparent", color: d.accent, fontWeight: 700, cursor: "pointer", fontSize: 13 }}>Clear all</button>}
          <span aria-live="polite" style={{ marginLeft: "auto" }}>Showing {Math.min(shown, results.length)} of {results.length}</span>
        </div>
        </div>}
        {/* Results */}
        {results.length === 0 && items.length === 0 ? (
          <EmptyCategory d={d} base={base} radius={radius} line={line} heading={mode === "category" ? heading : undefined} isService={isService} storeName={store.name} />
        ) : results.length === 0 ? (
          <div style={{ textAlign: "center", padding: "64px 20px", background: d.surface, border: `1px solid ${line}`, borderRadius: radius }}>
            <div aria-hidden style={{ width: 64, height: 64, margin: "0 auto 18px", borderRadius: 999, display: "grid", placeItems: "center", background: `${d.primary}1f`, color: d.accent }}><Search size={28} /></div>
            <h2 style={{ fontFamily: d.headingFont, fontSize: 26, margin: 0, color: d.text }}>No matches</h2>
            <p style={{ color: d.muted, fontSize: 16, margin: "10px auto 24px", maxWidth: 420, lineHeight: 1.6 }}>Try a different word, another category or a higher price limit.</p>
            <div style={{ display: "flex", gap: 10, justifyContent: "center", flexWrap: "wrap" }}>
              {hasFilters && <button type="button" onClick={reset} style={{ border: 0, cursor: "pointer", padding: "12px 22px", borderRadius: d.buttonStyle === "pill" ? 999 : Math.min(radius, 12), background: d.primary, color: readableOn(d.primary), fontWeight: 800, fontSize: 14 }}>Show everything</button>}
            </div>
          </div>
        ) : view === "grid" ? (
          <div className="bn-grid cx-products" style={{ gridTemplateColumns: `repeat(auto-fill, minmax(${gridMin}px, 1fr))`, gap: gridGap }}>
            {results.slice(0, shown).map((item) => (
              <div key={`${item.kind}-${item.id}`} className="cx-card" style={cardFx}>
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
                    <div style={{ fontWeight: 800, color: d.accent, marginTop: 6 }}>{item.currency} {formatNumber(item.price)}</div>
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

      {bottomSlot}
      {!externalChrome && <BuilderFooter store={store} d={d} visible={[]} storeLinks={storeLinks} />}
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
    <button type="button" aria-live="polite" style={{ ...shape, border: 0, background: d.primary, color: readableOn(d.primary) }}
      onClick={() => { addItem(slug, { productId: item.id, name: item.name, price: item.price, currency: item.currency, image: item.image }); setAdded(true); }}>
      {added ? "Added to cart" : "Add to cart"}
    </button>
  );
}


/**
 * Shown when a category (or the whole shop) has nothing published yet. Instead of a dead end it tells the visitor what
 * is going on, offers a way to ask the owner, and lists the store's other categories so they can keep browsing.
 */
function EmptyCategory({ d, base, radius, line, heading, isService, storeName }: {
  d: BuilderConfig["design"]; base: string; radius: number; line: string; heading?: string; isService: boolean; storeName: string;
}) {
  const others = useStoreCategories()
    .filter((c) => !c.parentId && !/^d\d/.test(c.id) && c.name !== heading)
    .slice(0, 6);
  const btn = (primary: boolean): React.CSSProperties => ({
    display: "inline-flex", alignItems: "center", gap: 8, padding: "13px 22px", fontWeight: 800, fontSize: 14,
    borderRadius: d.buttonStyle === "pill" ? 999 : Math.min(radius, 12),
    background: primary ? d.primary : "transparent", color: primary ? readableOn(d.primary) : d.text,
    border: primary ? `1px solid ${d.primary}` : `1px solid ${d.text}33`,
  });
  return (
    <div style={{ display: "grid", gap: 28 }}>
      <div style={{ position: "relative", overflow: "hidden", display: "grid", gridTemplateColumns: "minmax(0,1.2fr) minmax(0,.8fr)", alignItems: "center", gap: 24, padding: "clamp(28px,5vw,56px)", background: `linear-gradient(135deg, ${d.primary}10, ${d.accent}18), ${d.surface}`, border: `1px solid ${line}`, borderRadius: Math.max(radius, 14) }} className="cx-empty">
        <div>
          <span style={{ display: "inline-flex", alignItems: "center", gap: 8, fontSize: 12, fontWeight: 800, letterSpacing: ".1em", textTransform: "uppercase", color: d.accent, background: `${d.accent}1a`, padding: "6px 12px", borderRadius: 999 }}><Compass size={14} aria-hidden /> Coming soon</span>
          <h2 style={{ fontFamily: d.headingFont, fontSize: "clamp(26px,3.6vw,40px)", lineHeight: 1.1, letterSpacing: "-.02em", margin: "16px 0 12px", color: d.text }}>{heading ? `${heading} are on the way` : "New listings are on the way"}</h2>
          <p style={{ color: d.muted, fontSize: 16, lineHeight: 1.7, margin: "0 0 26px", maxWidth: 480 }}>
            {heading ? `${storeName} hasn't published anything under ${heading} yet.` : `${storeName} hasn't published anything here yet.`} You can ask the team directly, or look through the rest of what is available.
          </p>
          <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
            <Link href={`${base}/contact`} style={btn(true)}><MessageCircle size={16} aria-hidden /> {heading ? `Ask about ${heading}` : "Contact us"}</Link>
            <Link href={`${base}/catalog`} style={btn(false)}>Browse all {isService ? "services" : "products"} <ArrowRight size={16} aria-hidden /></Link>
          </div>
        </div>
        <svg aria-hidden viewBox="0 0 240 200" style={{ width: "100%", maxWidth: 300, justifySelf: "center" }} className="cx-art">
          <circle cx="120" cy="100" r="86" fill={d.accent} opacity=".10" />
          <circle cx="120" cy="100" r="58" fill={d.primary} opacity=".10" />
          <rect x="62" y="64" width="116" height="78" rx="12" fill={d.surface} stroke={d.text} strokeOpacity=".18" />
          <rect x="74" y="78" width="46" height="8" rx="4" fill={d.accent} opacity=".7" />
          <rect x="74" y="94" width="92" height="6" rx="3" fill={d.text} opacity=".14" />
          <rect x="74" y="108" width="70" height="6" rx="3" fill={d.text} opacity=".14" />
          <rect x="74" y="122" width="34" height="10" rx="5" fill={d.primary} opacity=".8" />
          <circle cx="182" cy="62" r="5" fill={d.accent} /><circle cx="52" cy="150" r="4" fill={d.primary} opacity=".6" /><circle cx="196" cy="140" r="3" fill={d.accent} opacity=".6" />
        </svg>
      </div>
      {others.length > 0 && (
        <section aria-label="Other categories">
          <h3 style={{ fontFamily: d.headingFont, fontSize: 20, margin: "0 0 14px", color: d.text }}>Explore other categories</h3>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(210px, 1fr))", gap: 12 }}>
            {others.map((c) => (
              <Link key={c.id} href={`${base}/category/${c.slug || c.id}`} style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 10, padding: "16px 18px", background: d.surface, border: `1px solid ${line}`, borderRadius: Math.min(radius, 14), color: d.text, fontWeight: 700 }}>
                <span>{c.name}{c.count > 0 && <small style={{ display: "block", color: d.muted, fontWeight: 500, marginTop: 2 }}>{c.count} {c.count === 1 ? "item" : "items"}</small>}</span>
                <ArrowRight size={16} aria-hidden style={{ color: d.accent, flex: "none" }} />
              </Link>
            ))}
          </div>
        </section>
      )}
    </div>
  );
}


function Applied({ label, onRemove, d, line }: { label: string; onRemove: () => void; d: BuilderConfig["design"]; line: string }) {
  return (
    <span style={{ display: "inline-flex", alignItems: "center", gap: 6, padding: "5px 6px 5px 12px", borderRadius: 999, border: `1px solid ${line}`, background: d.surface, color: d.text, fontWeight: 650, fontSize: 13 }}>
      {label}
      <button type="button" aria-label={`Remove filter ${label}`} onClick={onRemove} style={{ border: 0, background: `${d.text}10`, color: d.text, cursor: "pointer", width: 20, height: 20, borderRadius: 999, display: "grid", placeItems: "center", padding: 0 }}><X size={12} aria-hidden /></button>
    </span>
  );
}
