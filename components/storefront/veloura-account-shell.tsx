import type React from "react";
import Link from "next/link";
import { CalendarDays, Heart, WalletCards, Star, MessageCircle, Headphones, LogOut, UserRound, Settings2, Search, MapPin, Phone, Mail, Clock3 } from "lucide-react";
import { getHotelContent } from "@/lib/hotel-content";
import { getStoreCustomerOverview } from "@/lib/actions/account";
import { getStoreBranding } from "@/lib/actions/store-branding";
import { getStoreCustomerSessionForStore } from "@/lib/store-customer-auth";
import { getWallet } from "@/lib/actions/customer-wallet";
import { getStoreLoyaltySummary } from "@/lib/actions/loyalty";
import { getUnreadStoreMessageCount } from "@/lib/actions/account";
import { VelouraAccountNav } from "@/components/storefront/veloura-account-nav";

export type VelouraAccountPage = "account" | "bookings" | "wishlist" | "rewards" | "payments" | "preferences" | "messages" | "support";

export function VelouraAccountHero({ title, subtitle, image }: { title: string; subtitle: string; image?: string | null }) {
  return <div className="veloura-account-hero" style={image ? { backgroundImage: `linear-gradient(90deg, rgba(3,28,21,.96) 0%, rgba(3,28,21,.62) 42%, rgba(3,28,21,.18) 100%), url(${image})` } : undefined}>
    <div><h1>{title}</h1><p>{subtitle}</p></div><span>Luxury<br/>Redefined.<br/>Moments That Matter.</span>
  </div>;
}

export async function VelouraAccountShell({ children, slug, active, store: passedStore, membership: passedMembership }: {
  children: React.ReactNode; slug: string; active?: VelouraAccountPage; store?: any; membership?: any;
}) {
  const [store, membership, overview, wallet, loyalty, unread] = await Promise.all([
    passedStore ? Promise.resolve(passedStore) : getStoreBranding(slug),
    passedMembership ? Promise.resolve(passedMembership) : getStoreCustomerSessionForStore(slug),
    getStoreCustomerOverview(slug),
    getWallet(slug),
    getStoreLoyaltySummary(slug),
    getUnreadStoreMessageCount(slug),
  ]);
  if (!store || !membership) return <>{children}</>;
  const hotel = await getHotelContent(slug);
  const colors = (store.themeColors ?? {}) as Record<string, string>;
  const accent = colors.accent || colors.primary || "#c9953e";
  const bg = colors.background || "#f6f7f5";
  const user = membership.user;
  const address = overview?.defaultAddress;
  const location = [address?.city, address?.state, address?.country].filter(Boolean).join(", ");
  const heroImage = hotel.rooms.find((r: any) => r.featured)?.image || hotel.rooms[0]?.image || store.bannerUrl || null;
  const hotelContact = hotel.contact as any;
  const hotelAddress = [hotelContact?.address, hotelContact?.city, hotelContact?.state, hotelContact?.country].filter(Boolean).join(", ") || location;

  const css = { "--veloura-accent": accent, "--veloura-bg": bg, "--veloura-forest": colors.primary || "#032b22" } as React.CSSProperties;

  return <div className="veloura-account" style={css}>
    <header className="veloura-topbar">
      <div className="veloura-topbar-inner">
        <span><MapPin /> {hotelAddress || ""}</span>
        <div><span>{store.contactPhone && <><Phone /> {store.contactPhone}</>}</span><span>{store.contactEmail && <><Mail /> {store.contactEmail}</>}</span><span>◎ EN⌄</span></div>
      </div>
    </header>
    <header className="veloura-mainnav">
      <Link href={`/store/${slug}`} className="veloura-brand">
        {store.logoUrl ? <img src={store.logoUrl} alt={store.name} /> : <span className="veloura-brand-mark">✧</span>}
        <span>{store.name}</span>
      </Link>
      <nav>{[["Home", `/store/${slug}`],["Rooms", `/store/${slug}/rooms`],["Dining", `/store/${slug}/dining`],["Amenities", `/store/${slug}/amenities`],["Events", `/store/${slug}/events`],["Gallery", `/store/${slug}/gallery`],["Offers", `/store/${slug}/offers`],["Contact", `/store/${slug}/contact`]].map(([label,href]) => <Link key={label} href={href}>{label}</Link>)}</nav>
      <div className="veloura-nav-actions"><Search /><Link href={`/store/${slug}/account`} className="veloura-user"><UserRound /><span>{user.name || user.email}<small>My Account⌄</small></span></Link><Link href={`/store/${slug}/book`} className="veloura-book">Book Now <span>→</span></Link></div>
    </header>

    <div className="veloura-account-body">
      <aside className="veloura-sidebar">
        <div className="veloura-profile-mini">
          <div className="veloura-avatar">{user.image ? <img src={user.image} alt="" /> : <UserRound />}</div>
          <h2>{user.name || user.email}</h2><p>Guest</p><strong>✦ Guest Account</strong>
        </div>
<VelouraAccountNav slug={slug} unread={unread} />
        <Link href={`/store/${slug}/offers`} className="veloura-side-offer">{heroImage && <img src={heroImage} alt="" />}<div><span>More Than a Stay</span><strong>A Better You</strong></div><em>Explore Our Offers →</em></Link>
      </aside>
      <main className="veloura-account-main">{children}</main>
    </div>

    <footer className="veloura-footer">
      <div className="veloura-footer-grid">
        <div><div className="veloura-footer-brand">{store.logoUrl ? <img src={store.logoUrl} alt={store.name} /> : <span>✧</span>}<strong>{store.name}</strong></div><p>{store.businessDescription || "Luxury redefined. Moments that matter."}</p><div className="veloura-social">◎　f　𝕏　in　▶</div></div>
        <div><h4>Quick Links</h4>{["Home","Rooms","Dining","Amenities","Events","Gallery","Offers","Contact"].map(x=><Link key={x} href={`/store/${slug}/${x === "Home" ? "" : x.toLowerCase()}`}>{x}</Link>)}</div>
        <div><h4>Guest Services</h4>{[["My Bookings",`/store/${slug}/account/bookings`],["Special Requests",`/store/${slug}/account/messages`],["Airport Transfers",`/store/${slug}/account/messages`],["Concierge",`/store/${slug}/account/support`],["FAQ",`/store/${slug}/support`],["Terms & Conditions",`/store/${slug}/terms`],["Privacy Policy",`/store/${slug}/privacy`]].map(([x,h])=><Link key={x} href={h}>{x}</Link>)}</div>
        <div><h4>Contact Information</h4>{hotelAddress && <p><MapPin /> {hotelAddress}</p>}{store.contactPhone && <p><Phone /> {store.contactPhone}</p>}{store.contactEmail && <p><Mail /> {store.contactEmail}</p>}<p><Clock3 /> 24/7 Front Desk</p></div>
        <div><h4>Join Our Newsletter</h4><p>Get exclusive offers and updates.</p><div className="veloura-newsletter"><input placeholder="Your email address" /><button>→</button></div></div>
      </div><div className="veloura-footer-bottom"><span>© {new Date().getFullYear()} {store.name}. All rights reserved.</span><span>A Higher Standard of Hospitality.</span></div>
    </footer>
  </div>;
}