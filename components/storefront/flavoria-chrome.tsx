"use client";
import "./flavoria-home.css";
import Link from "next/link";
import { useState, useTransition, type FormEvent, type ReactNode } from "react";
import { Clock3, MapPin, Phone, Mail, UtensilsCrossed } from "lucide-react";
import { storeHref as href } from "@/lib/utils/store-href";
import { subscribeToNewsletter } from "@/lib/actions/newsletter";
import { businessAddress, businessEmail, businessHours, businessPhone } from "@/lib/storefront/business-details";
import { FooterSocial } from "@/components/storefront/footer-social";
import { CartLink } from "@/components/storefront/cart-link";
import { AccountLink } from "@/components/storefront/account-link";
import { useStoreCategories } from "@/components/storefront/store-categories";

export const FV_NAV: [string, string][] = [["Home", "/"], ["About us", "/about"], ["Menu", "/catalog"], ["Reservation", "/reservations"], ["Gallery", "/gallery"], ["Contact", "/contact"]];
export const bgImg = (u?: string | null) => (u ? { backgroundImage: `url(${u})` } : undefined);

/** Splits a headline so its last words can be set in the accent script style. */
export function Headline({ text, accent = 1 }: { text: string; accent?: number }) {
  const words = text.trim().split(/\s+/);
  if (words.length < 2) return <>{text}</>;
  const n = Math.min(accent, words.length - 1);
  return <>{words.slice(0, -n).join(" ")} <em>{words.slice(-n).join(" ")}</em></>;
}

/** Info bar, header, page content and footer shared by every Flavoria page. `active` is the nav label that is current. */
export function FlavoriaShell({ store, slug, active, children }: { store: any; slug: string; active: string; children: ReactNode }) {
  const cats = useStoreCategories();
  const desc = store.business?.description?.trim() || "";
  const addr = businessAddress(store), phone = businessPhone(store), mail = businessEmail(store), hours = businessHours(store);
  const topCats = cats.filter((c) => !c.parentId);
  let menuCats = topCats.length === 1 ? cats.filter((c) => c.parentId === topCats[0].id) : topCats;
  if (!menuCats.length) menuCats = topCats;
  const social = store.socialLinks && Object.values(store.socialLinks).some(Boolean) ? store.socialLinks : null;
  const nav = FV_NAV;
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
            {nav.map(([label, p], n) => <Link key={label} href={href(slug, p)} className={label === active ? "on" : ""}>{label}</Link>)}
          </nav>
          <div className="fv-head-act">
            <CartLink storeSlug={slug} accent="#E8590C" ink="#1c2414" />
            <AccountLink storeSlug={slug} ink="#1c2414" />
            <Link className="fv-btn" href={href(slug, "/reservations")}>Book a table</Link>
          </div>
        </div>
      </header>

      {children}
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
