"use client";
import type React from "react";
import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { LayoutGrid } from "lucide-react";
import { storeHref as href } from "@/lib/utils/store-href";
import { RestaurantHeader, RestaurantFooter, RestaurantBanner } from "@/components/storefront/restaurant-chrome";
import { Dish, type RestaurantItem } from "@/components/storefront/restaurant-home";
import { useStoreCategories } from "@/components/storefront/store-categories";

const PAGE = 12;
const useTopCategories = () => {
  const all = useStoreCategories();
  let top = all.filter((c) => !c.parentId);
  // One umbrella category (e.g. "Menu") that only holds the real sections: use the sections.
  if (top.length === 1 && all.some((c) => c.parentId === top[0].id)) top = all.filter((c) => c.parentId === top[0].id);
  return { all, top };
};
const catHref = (slug: string, c: { id: string; slug?: string | null }) => href(slug, `/category/${c.slug || c.id}`);

/** Menu: every dish, with the vendor's categories as tabs, a sort and page numbers. `categoryId` opens on one category. */
export function RestaurantMenu({ store, slug, items, categoryId, heading, query }: { store: any; slug: string; items: RestaurantItem[]; categoryId?: string; heading?: string; query?: string }) {
  const { all, top } = useTopCategories();
  const [sort, setSort] = useState("featured");
  const [page, setPage] = useState(1);
  const q = (query || "").trim().toLowerCase();
  const current = categoryId ? all.find((c) => c.id === categoryId) : undefined;
  const list = useMemo(() => {
    const base = q ? items.filter((i) => `${i.name} ${i.description ?? ""} ${i.categoryName ?? ""}`.toLowerCase().includes(q)) : items;
    const copy = [...base];
    if (sort === "low") copy.sort((a, b) => a.price - b.price);
    else if (sort === "high") copy.sort((a, b) => b.price - a.price);
    else if (sort === "name") copy.sort((a, b) => a.name.localeCompare(b.name));
    return copy;
  }, [items, q, sort]);
  useEffect(() => setPage(1), [sort, q, categoryId]);
  const pages = Math.max(1, Math.ceil(list.length / PAGE));
  const shown = list.slice((page - 1) * PAGE, page * PAGE);
  const banner = items.find((i) => i.image)?.image || store.bannerUrl || null;
  const title = q ? "Search results" : categoryId ? heading || current?.name || "Menu" : "Our Menu";
  return (
    <>
      <RestaurantHeader store={store} slug={slug} />
      <main className="rs-home">
        <RestaurantBanner slug={slug} crumb={categoryId ? heading || "Menu" : "Menu"} title={title} subtitle={q ? `Dishes matching “${query}”` : `Explore our delicious menu and order your favorites.`} image={banner} />
        <div className="rs-tabs" role="tablist">
          <Link href={href(slug, "/catalog")} className={!categoryId ? "on" : ""}><LayoutGrid size={16} /> All Dishes</Link>
          {top.map((c) => <Link key={c.id} href={catHref(slug, c)} className={categoryId === c.id || (current && current.parentId === c.id) ? "on" : ""}>{c.name}</Link>)}
        </div>
        <div className="rs-listhead">
          <h2>{categoryId ? heading || current?.name : "All Dishes"} <span>({list.length})</span></h2>
          <label className="rs-sort">Sort by:
            <select value={sort} onChange={(e) => setSort(e.target.value)}>
              <option value="featured">Popular</option><option value="low">Price: low to high</option><option value="high">Price: high to low</option><option value="name">Name</option>
            </select>
          </label>
        </div>
        {shown.length ? <div className="rs-dishes">{shown.map((i) => <Dish key={i.id} item={i} slug={slug} />)}</div> : <p className="rs-empty">{q ? `Nothing on the menu matches “${query}”.` : "No dishes in this category yet."}</p>}
        {pages > 1 && (
          <div className="rs-pager">
            <button disabled={page === 1} onClick={() => setPage(page - 1)} aria-label="Previous page">‹</button>
            {Array.from({ length: pages }, (_, n) => <button key={n} className={page === n + 1 ? "on" : ""} onClick={() => setPage(n + 1)}>{n + 1}</button>)}
            <button disabled={page === pages} onClick={() => setPage(page + 1)} aria-label="Next page">›</button>
          </div>
        )}
      </main>
      <RestaurantFooter store={store} slug={slug} />
    </>
  );
}

const TINT = ["t0", "t1", "t2", "t3"];
/** Categories: one tile per category the vendor created, with a dish count. */
export function RestaurantCategories({ store, slug, items }: { store: any; slug: string; items: RestaurantItem[] }) {
  const { all, top } = useTopCategories();
  const tiles = top.map((c) => {
    const names = new Set([c.name, ...all.filter((x) => x.parentId === c.id).map((x) => x.name)]);
    const inside = items.filter((i) => i.categoryName && names.has(i.categoryName));
    return { c, count: Math.max(inside.length, c.count || 0), image: c.imageUrl || inside.find((i) => i.image)?.image || null, own: !!c.imageUrl };
  });
  const banner = items.find((i) => i.image)?.image || store.bannerUrl || null;
  return (
    <>
      <RestaurantHeader store={store} slug={slug} />
      <main className="rs-home">
        <RestaurantBanner slug={slug} crumb="Categories" title="Food Categories" subtitle="Browse by category and discover your next favorite meal." image={banner} />
        {tiles.length === 0 ? <p className="rs-empty">No categories yet.</p> : (
          <div className="rs-tiles">
            {tiles.map(({ c, count, image, own }, n) => (
              <Link key={c.id} href={catHref(slug, c)} className={`rs-tile ${TINT[n % 4]}`}>
                <i className={own ? "cover" : ""} style={image ? { backgroundImage: `url(${image})` } : undefined} />
                <div><section><b>{c.name}</b><span>{count} {count === 1 ? "Dish" : "Dishes"}</span></section><u>→</u></div>
              </Link>
            ))}
          </div>
        )}
      </main>
      <RestaurantFooter store={store} slug={slug} />
    </>
  );
}
