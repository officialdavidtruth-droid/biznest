"use client";
import Link from "next/link";
import { ArrowRight, Star } from "lucide-react";
import { storeHref as href } from "@/lib/utils/store-href";
import { formatMoney } from "@/lib/utils/format-money";
import { useCart } from "@/lib/cart-context";
import { RestaurantHeader, RestaurantFooter } from "@/components/storefront/restaurant-chrome";

export type RestaurantItem = { id: string; kind: "product" | "service"; name: string; description: string | null; price: number; currency: string; image: string | null; categoryName: string | null; hasVariants?: boolean };
type Ev = { title: string; slug: string; date: string; image?: string };
const bg = (u?: string | null) => (u ? { backgroundImage: `url(${u})` } : {});

export function Dish({ item, slug }: { item: RestaurantItem; slug: string }) {
  const { items, storeSlug, addItem } = useCart();
  const inCart = storeSlug === slug ? items.find((x) => x.productId === item.id) : null;
  const url = href(slug, `/${item.kind}/${item.id}`);
  return (
    <article className="rs-dish">
      <Link href={url} className="rs-dish-img" style={bg(item.image)} aria-label={item.name} />
      <div className="rs-dish-body">
        <h3><Link href={url}>{item.name}</Link></h3>
        {item.description && <p>{item.description}</p>}
        <strong>{formatMoney(Math.round(item.price), item.currency)}</strong>
      </div>
      {item.hasVariants ? (
        <Link className="rs-opts" href={url}>Options</Link>
      ) : (
        <button type="button" className="rs-add" aria-label={`Add ${item.name} to cart`} onClick={() => addItem(slug, { productId: item.id, name: item.name, price: item.price, currency: item.currency, image: item.image })}>
          {inCart ? inCart.quantity : "+"}
        </button>
      )}
    </article>
  );
}

/** Restaurant home: every block is filled from the store's own menu, reviews and events. Nothing here is a placeholder. */
export function RestaurantHome({ store, slug, items, reviews = [], avgRating, events = [] }: { store: any; slug: string; items: RestaurantItem[]; reviews?: any[]; avgRating: number | null; events?: Ev[] }) {
  const ho = (store.heroOverrides || {}) as { headline?: string; subtitle?: string; ctaLabel?: string };
  const hero = store.bannerUrl || items.find((i) => i.image)?.image || null;
  const groups = new Map<string, { name: string; count: number; image: string | null }>();
  for (const i of items) {
    if (!i.categoryName) continue;
    const g = groups.get(i.categoryName) || { name: i.categoryName, count: 0, image: null };
    g.count++; g.image = g.image || i.image; groups.set(i.categoryName, g);
  }
  const cats = [...groups.values()];
  const popular = items.slice(0, 8);
  const good = reviews.filter((r: any) => r?.comment && r.rating >= 4).slice(0, 3);
  const nextEvent = events[0];
  const desc = ho.subtitle?.trim() || store.business?.description || `Order from ${store.name} for pickup or delivery, or book a table.`;
  return (
    <>
      <RestaurantHeader store={store} slug={slug} />
      <main className="rs-home">
        <section className="rs-hero">
          <div>
            <h1>{ho.headline?.trim() || store.name}</h1>
            <p>{desc}</p>
            <div className="rs-btns">
              <Link className="rs-btn" href={href(slug, "/catalog")}>{ho.ctaLabel?.trim() || "Order now"} <ArrowRight size={16} /></Link>
              <Link className="rs-btn ghost" href={href(slug, "/reservations")}>Book a table</Link>
            </div>
            {avgRating && reviews.length > 0 && <div className="rs-rate"><Star size={16} fill="#fff" /> <b>{avgRating.toFixed(1)}</b> from {reviews.length} review{reviews.length === 1 ? "" : "s"}</div>}
          </div>
          <div className="rs-hero-img" style={bg(hero)} />
        </section>

        <section className="rs-strip">
          <Link href={href(slug, "/catalog")}><b>{items.length}</b><span>dishes on the menu</span></Link>
          {cats.length > 0 && <Link href={href(slug, "/catalog")}><b>{cats.length}</b><span>categories to browse</span></Link>}
          <Link href={href(slug, "/reservations")}><b>Reserve</b><span>a table online</span></Link>
          <Link href={href(slug, "/track")}><b>Track</b><span>your order</span></Link>
        </section>

        {cats.length > 0 && (
          <section className="rs-sec">
            <div className="rs-sec-head"><h2>Explore by category</h2><Link href={href(slug, "/catalog")}>View all</Link></div>
            <div className="rs-cats">
              {cats.map((c) => (
                <Link key={c.name} className="rs-cat" href={href(slug, "/catalog")}>
                  <i style={bg(c.image)} /><b>{c.name}</b><span>{c.count} item{c.count === 1 ? "" : "s"}</span>
                </Link>
              ))}
            </div>
          </section>
        )}

        {popular.length > 0 && (
          <section className="rs-sec">
            <div className="rs-sec-head"><h2>Popular dishes</h2><Link href={href(slug, "/catalog")}>See full menu</Link></div>
            <div className="rs-dishes">{popular.map((i) => <Dish key={i.id} item={i} slug={slug} />)}</div>
          </section>
        )}

        <section className="rs-sec rs-promos">
          {nextEvent ? (
            <Link className="rs-banner" href={href(slug, `/events/${nextEvent.slug}`)} style={nextEvent.image ? { backgroundImage: `linear-gradient(90deg,rgba(36,22,8,.85),rgba(36,22,8,.35)),url(${nextEvent.image})` } : undefined}>
              <b>{nextEvent.title}</b><span>{nextEvent.date} · See the details</span>
            </Link>
          ) : (
            <Link className="rs-banner" href={href(slug, "/gallery")}><b>See the gallery</b><span>Photos and videos from our kitchen and dining room</span></Link>
          )}
          <Link className="rs-banner alt" href={href(slug, "/reservations")}><b>Book a table</b><span>Pick a date and time and we will hold it for you</span></Link>
        </section>

        {good.length > 0 && (
          <section className="rs-sec">
            <div className="rs-sec-head"><h2>What guests say</h2><Link href={href(slug, "/reviews")}>All reviews</Link></div>
            <div className="rs-reviews">{good.map((r: any, n: number) => <div key={n} className="rs-review">“{r.comment}”<b>{"★".repeat(Math.round(r.rating))} {r.customerName || r.name || "Guest"}</b></div>)}</div>
          </section>
        )}
      </main>
      <RestaurantFooter store={store} slug={slug} />
    </>
  );
}
