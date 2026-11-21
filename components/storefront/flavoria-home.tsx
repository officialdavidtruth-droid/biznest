"use client";
import "./flavoria-home.css";
import Link from "next/link";
import { useState, useTransition, type FormEvent } from "react";
import { ArrowRight, CalendarDays, Clock3, MapPin, Phone, Mail, Plus, Users, UtensilsCrossed } from "lucide-react";
import { storeHref as href } from "@/lib/utils/store-href";
import { formatMoney } from "@/lib/utils/format-money";
import { useCart } from "@/lib/cart-context";
import { subscribeToNewsletter } from "@/lib/actions/newsletter";
import { businessAddress, businessEmail, businessHours, businessPhone } from "@/lib/storefront/business-details";
import { FooterSocial } from "@/components/storefront/footer-social";
import { CartLink } from "@/components/storefront/cart-link";
import { AccountLink } from "@/components/storefront/account-link";
import { useStoreCategories } from "@/components/storefront/store-categories";
import type { RestaurantItem } from "@/components/storefront/restaurant-home";

type Ev = { title: string; slug: string; date: string; image?: string };
const bg = (u?: string | null) => (u ? { backgroundImage: `url(${u})` } : undefined);
const GREEN = "#2F3E1E";

function Card({ item, slug }: { item: RestaurantItem; slug: string }) {
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

/** Splits a headline so its last word can be set in the accent script style. */
function Headline({ text }: { text: string }) {
  const words = text.trim().split(/\s+/);
  if (words.length < 2) return <>{text}</>;
  const last = words.slice(-1)[0];
  return <>{words.slice(0, -1).join(" ")} <em>{last}</em></>;
}

export function FlavoriaHome({ store, slug, items, events = [] }: { store: any; slug: string; items: RestaurantItem[]; events?: Ev[] }) {
  const cats = useStoreCategories();
  const ho = (store.heroOverrides || {}) as { headline?: string; subtitle?: string; ctaLabel?: string };
  const withImg = items.filter((i) => i.image);
  const heroImg = store.bannerUrl || withImg[0]?.image || null;
  const aboutImg = withImg[1]?.image || store.bannerUrl || heroImg;
  const popular = items.slice(0, 4);
  const desc = store.business?.description?.trim() || "";
  const addr = businessAddress(store), phone = businessPhone(store), mail = businessEmail(store), hours = businessHours(store);
  const event = events[0];
  const topCats = cats.filter((c) => !c.parentId);
  let menuCats = topCats.length === 1 ? cats.filter((c) => c.parentId === topCats[0].id) : topCats;
  if (!menuCats.length) menuCats = topCats;
  const social = store.socialLinks && Object.values(store.socialLinks).some(Boolean) ? store.socialLinks : null;

  const [date, setDate] = useState("");
  const [guests, setGuests] = useState("2");
  const [email, setEmail] = useState("");
  const [status, setStatus] = useState("");
  const [busy, start] = useTransition();
  const subscribe = (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault(); setStatus("");
    const fd = new FormData(e.currentTarget);
    start(async () => {
      const r = await subscribeToNewsletter(slug, fd);
      if (r.success) { setEmail(""); setStatus("You are subscribed."); } else setStatus(r.error ?? "Could not subscribe. Try again.");
    });
  };
  const nav: [string, string][] = [["Home", "/"], ["About us", "/about"], ["Menu", "/catalog"], ["Reservation", "/reservations"], ["Gallery", "/gallery"], ["Contact", "/contact"]];

  return (
    <div className="fv">
      {(addr || hours || phone || social) && (
        <div className="fv-info">
          <div className="fv-wrap">
            {addr && <span><MapPin size={14} /> {addr}</span>}
            {hours && <span><Clock3 size={14} /> {hours}</span>}
            {phone && <a href={`tel:${phone}`}><Phone size={14} /> {phone}</a>}
            {social && <FooterSocial className="fv-social" social={social} />}
          </div>
        </div>
      )}
      <header className="fv-head">
        <div className="fv-wrap">
          <Link href={href(slug, "/")} className="fv-brand">
            {store.logoUrl ? <img src={store.logoUrl} alt="" /> : <UtensilsCrossed size={30} color="#E8590C" />}
            <b>{store.name}</b>
          </Link>
          <nav aria-label="Main">
            {nav.map(([label, p], n) => <Link key={label} href={href(slug, p)} className={n === 0 ? "on" : ""}>{label}</Link>)}
          </nav>
          <div className="fv-head-act">
            <CartLink storeSlug={slug} accent="#E8590C" ink="#1c2414" />
            <AccountLink storeSlug={slug} ink="#1c2414" />
            <Link className="fv-btn" href={href(slug, "/reservations")}>Book a table</Link>
          </div>
        </div>
      </header>

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

      <footer className="fv-foot">
        <div className="fv-wrap fv-foot-grid">
          <div>
            <Link href={href(slug, "/")} className="fv-brand">{store.logoUrl ? <img src={store.logoUrl} alt="" /> : <UtensilsCrossed size={26} color="#E8590C" />}<b>{store.name}</b></Link>
            {desc && <p>{desc.length > 140 ? `${desc.slice(0, 137)}…` : desc}</p>}
            {social && <FooterSocial className="fv-social dark" social={social} />}
          </div>
          <div>
            <h4>Quick links</h4>
            {nav.slice(1).map(([label, p]) => <Link key={label} href={href(slug, p)}>{label}</Link>)}
          </div>
          {menuCats.length > 0 && (
            <div>
              <h4>Our menu</h4>
              {menuCats.slice(0, 6).map((c) => <Link key={c.id} href={href(slug, `/category/${c.slug || c.id}`)}>{c.name}</Link>)}
            </div>
          )}
          <div>
            <h4>Contact info</h4>
            {addr && <p><MapPin size={14} /> {addr}</p>}
            {phone && <p><Phone size={14} /> {phone}</p>}
            {mail && <p><Mail size={14} /> {mail}</p>}
          </div>
          <div>
            <h4>Newsletter</h4>
            <p>Subscribe to get the latest updates and offers.</p>
            <form className="fv-news" onSubmit={subscribe}>
              <input type="email" name="email" required placeholder="Enter your email" value={email} onChange={(e) => setEmail(e.target.value)} aria-label="Email" />
              <button disabled={busy}>Subscribe</button>
            </form>
            {status && <small>{status}</small>}
          </div>
        </div>
        <div className="fv-wrap fv-legal"><span>© {new Date().getFullYear()} {store.name}. All rights reserved.</span></div>
      </footer>
    </div>
  );
}
