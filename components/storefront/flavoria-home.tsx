"use client";
import "./flavoria-home.css";
import Link from "next/link";
import { useState } from "react";
import { ArrowRight, CalendarDays, Clock3, MapPin, Phone, Mail, Plus, Users, UtensilsCrossed } from "lucide-react";
import { storeHref as href } from "@/lib/utils/store-href";
import { formatMoney } from "@/lib/utils/format-money";
import { useCart } from "@/lib/cart-context";
import { FlavoriaShell, Headline } from "@/components/storefront/flavoria-chrome";
import type { RestaurantItem } from "@/components/storefront/restaurant-home";

type Ev = { title: string; slug: string; date: string; image?: string };
export const bg = (u?: string | null) => (u ? { backgroundImage: `url(${u})` } : undefined);
const GREEN = "#2F3E1E";

export function Card({ item, slug }: { item: RestaurantItem; slug: string }) {
  const { items, storeSlug, addItem } = useCart();
  const inCart = storeSlug === slug ? items.find((x) => x.productId === item.id) : null;
  const url = href(slug, `/${item.kind}/${item.id}`);
  return (
    <article className="fv-card">
      <Link href={url} className="fv-card-img" style={bg(item.image)} aria-label={item.name} />
      <div className="fv-card-body">
        <h3><Link href={url}>{item.name}</Link></h3>
        {item.description && <p>{item.description}</p>}
        <div className="fv-card-foot">
          <strong>{formatMoney(Math.round(item.price), item.currency)}</strong>
          {item.hasVariants
            ? <Link className="fv-plus" href={url} aria-label={`Choose options for ${item.name}`}><Plus size={16} /></Link>
            : <button type="button" className="fv-plus" aria-label={`Add ${item.name} to cart`} onClick={() => addItem(slug, { productId: item.id, name: item.name, price: item.price, currency: item.currency, image: item.image })}>{inCart ? inCart.quantity : <Plus size={16} />}</button>}
        </div>
      </div>
    </article>
  );
}

export function FlavoriaHome({ store, slug, items, events = [] }: { store: any; slug: string; items: RestaurantItem[]; events?: Ev[] }) {
  const ho = (store.heroOverrides || {}) as { headline?: string; subtitle?: string; ctaLabel?: string };
  const withImg = items.filter((i) => i.image);
  const heroImg = store.bannerUrl || withImg[0]?.image || null;
  const aboutImg = withImg[1]?.image || store.bannerUrl || heroImg;
  const popular = items.slice(0, 4);
  const desc = store.business?.description?.trim() || "";
  const event = events[0];

  const [date, setDate] = useState("");
  const [guests, setGuests] = useState("2");

  return (
    <FlavoriaShell store={store} slug={slug} active="Home">
      <section className="fv-hero">
        <div className="fv-wrap">
          <div className="fv-hero-copy">
            {store.business?.category && <small>{store.business.category}</small>}
            <h1><Headline text={ho.headline?.trim() || store.name} /></h1>
            {(ho.subtitle?.trim() || desc) && <p>{ho.subtitle?.trim() || desc}</p>}
            <div className="fv-btns">
              <Link className="fv-btn lg" href={href(slug, "/catalog")}><UtensilsCrossed size={16} /> {ho.ctaLabel?.trim() || "Explore menu"}</Link>
              <Link className="fv-btn lg ghost" href={href(slug, "/reservations")}><CalendarDays size={16} /> Book a table</Link>
            </div>
          </div>
          <div className="fv-hero-img">
            <div className="fv-plate" style={bg(heroImg)} />
            {items.length > 0 && <div className="fv-badge"><b>{items.length}</b><span>{items.length === 1 ? "Dish" : "Dishes"} on our menu</span></div>}
          </div>
        </div>
      </section>

      {desc && (
        <section className="fv-about">
          <div className="fv-wrap">
            <div className="fv-about-img" style={bg(aboutImg)} />
            <div className="fv-about-copy">
              <small>Welcome to {store.name}</small>
              <h2><Headline text={store.name} /></h2>
              <p>{desc}</p>
              <Link className="fv-btn green" href={href(slug, "/about")}>Learn more about us</Link>
            </div>
          </div>
        </section>
      )}

      {popular.length > 0 && (
        <section className="fv-popular">
          <div className="fv-wrap">
            <div className="fv-sec-head">
              <h2>Our Popular Dishes</h2>
              <Link href={href(slug, "/catalog")}>View full menu <ArrowRight size={14} /></Link>
            </div>
            <div className="fv-grid">{popular.map((i) => <Card key={i.id} item={i} slug={slug} />)}</div>
          </div>
        </section>
      )}

      <section className="fv-promo">
        <div className="fv-wrap">
          {event ? (
            <div className="fv-offer" style={{ background: GREEN }}>
              <div>
                <small>Coming up</small>
                <h3>{event.title}</h3>
                <p>{new Date(event.date).toLocaleDateString(undefined, { weekday: "long", day: "numeric", month: "long" })}</p>
                <Link className="fv-btn light" href={href(slug, `/events/${event.slug}`)}>See details <ArrowRight size={14} /></Link>
              </div>
              <i style={bg(event.image || withImg[2]?.image || heroImg)} />
            </div>
          ) : withImg[2] ? (
            <div className="fv-offer" style={{ background: GREEN }}>
              <div>
                <small>Today&apos;s pick</small>
                <h3>{withImg[2].name}</h3>
                <p>{formatMoney(Math.round(withImg[2].price), withImg[2].currency)}</p>
                <Link className="fv-btn light" href={href(slug, `/${withImg[2].kind}/${withImg[2].id}`)}>Order now <ArrowRight size={14} /></Link>
              </div>
              <i style={bg(withImg[2].image)} />
            </div>
          ) : null}
          <form className="fv-book" action={href(slug, "/reservations")} method="get">
            <h3>Book Your Table</h3>
            <label><CalendarDays size={15} /><input type="date" name="date" value={date} onChange={(e) => setDate(e.target.value)} aria-label="Date" /></label>
            <label><Users size={15} />
              <select name="party" value={guests} onChange={(e) => setGuests(e.target.value)} aria-label="Number of people">
                {[1, 2, 3, 4, 5, 6, 7, 8].map((n) => <option key={n} value={n}>{n} {n === 1 ? "person" : "people"}</option>)}
              </select>
            </label>
            <button className="fv-btn lg" type="submit">Find a table</button>
          </form>
        </div>
      </section>

    </FlavoriaShell>
  );
}
