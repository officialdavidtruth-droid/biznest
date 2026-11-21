"use client";
import type React from "react";
import Link from "next/link";
import { ChevronLeft } from "lucide-react";
import { storeHref as href } from "@/lib/utils/store-href";
import { RestaurantHeader, RestaurantFooter } from "@/components/storefront/restaurant-chrome";
import { Dish, type RestaurantItem } from "@/components/storefront/restaurant-home";
import { useStoreCategories } from "@/components/storefront/store-categories";

const bg = (u?: string | null) => (u ? { backgroundImage: `url(${u})` } : {});

/**
 * Menu pages for restaurants. The menu opens on the vendor's own categories (Dashboard > Categories); opening one lists its dishes.
 * `categoryId` set = a category page; unset = the category picker (or a flat result list when `query` is given).
 */
export function RestaurantMenu({ store, slug, items, categoryId, heading, query }: { store: any; slug: string; items: RestaurantItem[]; categoryId?: string; heading?: string; query?: string }) {
  const all = useStoreCategories();
  const top = all.filter((c) => !c.parentId);
  const kids = (id: string) => all.filter((c) => c.parentId === id);
  const link = (c: { id: string; slug?: string | null }) => href(slug, `/category/${c.slug || c.id}`);
  const q = (query || "").trim().toLowerCase();
  const shown = q ? items.filter((i) => `${i.name} ${i.categoryName ?? ""}`.toLowerCase().includes(q)) : items;
  const current = categoryId ? all.find((c) => c.id === categoryId) : undefined;
  const subs = current ? kids(current.id) : [];

  let body: React.ReactNode;
  if (!categoryId && !q) {
    const cards = top.map((c) => {
      const family = [c, ...kids(c.id)];
      const names = new Set(family.map((x) => x.name));
      const inside = items.filter((i) => i.categoryName && names.has(i.categoryName));
      const count = Math.max(inside.length, family.reduce((n, x) => n + (x.count || 0), 0));
      return { c, count, image: c.imageUrl || inside.find((i) => i.image)?.image || null, subs: kids(c.id) };
    }).filter((x) => x.count > 0 || x.subs.length > 0);
    const known = new Set(all.map((c) => c.name));
    const loose = items.filter((i) => !i.categoryName || !known.has(i.categoryName));
    body = cards.length === 0 ? (
      <div className="rs-dishes">{items.map((i) => <Dish key={i.id} item={i} slug={slug} />)}</div>
    ) : (
      <>
        <div className="rs-menucats">
          {cards.map(({ c, count, image, subs }) => (
            <Link key={c.id} href={link(c)} className="rs-menucat">
              <i style={bg(image)} />
              <div><b>{c.name}</b><span>{count} item{count === 1 ? "" : "s"}{subs.length ? ` · ${subs.length} sub-categories` : ""}</span>{c.description && <small>{c.description}</small>}</div>
            </Link>
          ))}
        </div>
        {loose.length > 0 && (<section className="rs-sec"><div className="rs-sec-head"><h2>More dishes</h2></div><div className="rs-dishes">{loose.map((i) => <Dish key={i.id} item={i} slug={slug} />)}</div></section>)}
      </>
    );
  } else {
    body = shown.length ? <div className="rs-dishes">{shown.map((i) => <Dish key={i.id} item={i} slug={slug} />)}</div> : <p className="rs-empty">{q ? `Nothing on the menu matches “${query}”.` : "No dishes in this category yet."}</p>;
  }

  return (
    <>
      <RestaurantHeader store={store} slug={slug} />
      <main className="rs-home">
        <div className="rs-pagehead">
          {categoryId && <Link href={href(slug, "/catalog")} className="rs-back"><ChevronLeft size={16} /> All categories</Link>}
          <h1>{q ? `Results for “${query}”` : categoryId ? heading || current?.name || "Menu" : "Our menu"}</h1>
          {!categoryId && !q && <p>Pick a category to see what is on offer.</p>}
          {current?.description && <p>{current.description}</p>}
        </div>
        {subs.length > 0 && (
          <div className="rs-chips">{subs.map((s) => <Link key={s.id} href={link(s)}>{s.name}</Link>)}</div>
        )}
        {body}
      </main>
      <RestaurantFooter store={store} slug={slug} />
    </>
  );
}
