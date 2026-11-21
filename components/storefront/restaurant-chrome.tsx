"use client";
import "./restaurant-chrome.css";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState, useTransition, type FormEvent } from "react";
import { Home, LayoutGrid, Heart, UtensilsCrossed, CalendarDays, Images, PartyPopper, Info, Star, Receipt, Phone, Search, MapPin, Mail } from "lucide-react";
import { storeHref as href } from "@/lib/utils/store-href";
import { subscribeToNewsletter } from "@/lib/actions/newsletter";
import { businessAddress, businessEmail, businessPhone } from "@/lib/storefront/business-details";
import { FooterSocial } from "@/components/storefront/footer-social";
import { FooterLinks, LegalLinks } from "@/components/storefront/store-menu";
import { CartLink } from "@/components/storefront/cart-link";
import { AccountLink } from "@/components/storefront/account-link";
import { useStoreCategories } from "@/components/storefront/store-categories";

type S = any;
const NAV: { key: string; label: string; path: string; Icon: any }[] = [
  { key: "home", label: "Home", path: "", Icon: Home },
  { key: "menu", label: "Menu", path: "/catalog", Icon: UtensilsCrossed },
  { key: "categories", label: "Categories", path: "/categories", Icon: LayoutGrid },
  { key: "reservations", label: "Reservations", path: "/reservations", Icon: CalendarDays },
  { key: "events", label: "Events", path: "/events", Icon: PartyPopper },
  { key: "gallery", label: "Gallery", path: "/gallery", Icon: Images },
  { key: "about", label: "About", path: "/about", Icon: Info },
  { key: "reviews", label: "Reviews", path: "/reviews", Icon: Star },
  { key: "orders", label: "Orders", path: "/account/orders", Icon: Receipt },
  { key: "contact", label: "Support", path: "/contact", Icon: Phone },
];

function Brand({ store, slug }: { store: S; slug: string }) {
  return (
    <Link href={href(slug)} className="rs-brand">
      {store.logoUrl ? <img src={store.logoUrl} alt="" /> : <span className="rs-mark">{String(store.name || "R").slice(0, 1).toUpperCase()}</span>}
      <b>{store.name}</b>
    </Link>
  );
}

export function RestaurantHeader({ store, slug }: { store: S; slug: string }) {
  const pathname = usePathname() || "/";
  const rest = pathname.replace(new RegExp(`^/(store/)?${slug}(?=/|$)`), "") || "/";
  const isActive = (p: string) => (p === "" ? rest === "/" || rest === "" : rest === p || rest.startsWith(p + "/") || (p === "/catalog" && /^\/(category|product|service)/.test(rest)) || (p === "/account/orders" && /^\/(orders|track)/.test(rest)));
  return (
    <>
      <aside className="rs-side" aria-label="Store navigation">
        <div className="rs-side-brand"><Brand store={store} slug={slug} /></div>
        <nav>
          {NAV.map(({ key, label, path, Icon }) => (
            <Link key={key} href={href(slug, path)} className={isActive(path) ? "on" : ""}><Icon size={18} /><span>{label}</span></Link>
          ))}
        </nav>
        <div className="rs-promo">
          <b>Table for tonight?</b>
          <p>Book ahead and we will have it ready.</p>
          <Link href={href(slug, "/reservations")}>Reserve a table</Link>
        </div>
      </aside>
      <header className="rs-top">
        <div className="rs-top-brand"><Brand store={store} slug={slug} /></div>
        <form className="rs-search" action={href(slug, "/catalog")} method="get" role="search">
          <Search size={16} />
          <input name="q" placeholder="Search for dishes and drinks" aria-label="Search the menu" />
          <button type="submit" aria-label="Search"><Search size={16} /></button>
        </form>
        <div className="rs-actions">
          <Link href={href(slug, "/favorites")} className="rs-act"><Heart size={22} /><span>Favorites</span></Link>
          <div className="rs-act"><CartLink storeSlug={slug} accent="#F4511E" ink="#241608" /><span>Cart</span></div>
          <div className="rs-act"><AccountLink storeSlug={slug} ink="#241608" /><span>Account</span></div>
        </div>
      </header>
    </>
  );
}

export function RestaurantFooter({ store, slug }: { store: S; slug: string }) {
  const cats = useStoreCategories().filter((c) => !c.parentId).slice(0, 5);
  const [email, setEmail] = useState("");
  const [status, setStatus] = useState<string | null>(null);
  const [pending, start] = useTransition();
  function submit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setStatus(null);
    const fd = new FormData(e.currentTarget);
    start(async () => {
      const res = await subscribeToNewsletter(slug, fd);
      if (res.success) { setEmail(""); setStatus("You are subscribed."); } else setStatus(res.error ?? "Could not subscribe. Try again.");
    });
  }
  const addr = businessAddress(store), phone = businessPhone(store), mail = businessEmail(store);
  return (
    <footer className="rs-foot">
      <div className="rs-foot-grid">
        <div>
          <Brand store={store} slug={slug} />
          {store.business?.description && <p>{store.business.description}</p>}
          {store.socialLinks && Object.values(store.socialLinks).some(Boolean) && <FooterSocial className="rs-social" social={store.socialLinks} />}
        </div>
        <div>
          <h4>Company</h4>
          <FooterLinks slug={slug} fallback={[["Home", "/"], ["Menu", "/catalog"], ["Reservations", "/reservations"], ["Events", "/events"], ["Gallery", "/gallery"], ["About", "/about"]]} />
          {cats.length > 0 && <h4 className="rs-sub">Categories</h4>}
          {cats.map((c) => <Link key={c.id} href={href(slug, `/category/${c.id}`)}>{c.name}</Link>)}
        </div>
        <div>
          <h4>Support</h4>
          <Link href={href(slug, "/account/orders")}>My orders</Link>
          <Link href={href(slug, "/reservations")}>Reservations</Link>
          <Link href={href(slug, "/contact")}>Contact us</Link>
          {addr && <p><MapPin size={14} /> {addr}</p>}
          {phone && <p><Phone size={14} /> {phone}</p>}
          {mail && <p><Mail size={14} /> {mail}</p>}
        </div>
        <div>
          <h4>Newsletter</h4><p>Subscribe to get the latest updates and exclusive offers.</p>
          <form onSubmit={submit} className="rs-news">
            <input name="email" type="email" required placeholder="Your email" value={email} onChange={(e) => setEmail(e.target.value)} disabled={pending} />
            <button type="submit" disabled={pending}>{pending ? "…" : "Subscribe"}</button>
          </form>
          {status && <p role="status" className="rs-status">{status}</p>}
        </div>
      </div>
      <div className="rs-foot-bottom"><span>© {new Date().getFullYear()} {store.name}. All rights reserved.</span><LegalLinks slug={slug} /></div>
    </footer>
  );
}

/** Page banner shared by every inner page: breadcrumb, big title (one word can be accented), subtitle, picture on the right. */
export function RestaurantBanner({ slug, crumb, title, accent, subtitle, image }: { slug: string; crumb: string; title: string; accent?: string; subtitle?: string; image?: string | null }) {
  return (
    <section className="rs-banner-top">
      <div>
        <nav className="rs-crumbs"><Link href={href(slug)}>Home</Link><span>›</span><span>{crumb}</span></nav>
        <h1>{title}{accent && <> <em>{accent}</em></>}</h1>
        {subtitle && <p>{subtitle}</p>}
      </div>
      {image && <div className="rs-banner-img" style={{ backgroundImage: `url(${image})` }} />}
    </section>
  );
}
