import type React from "react";
import Link from "next/link";
import { CalendarDays, Heart, Headphones, Home, LogOut, MessageCircle, Star, WalletCards, Menu, Search, UserRound } from "lucide-react";
import { SignOutButton } from "@/components/forms/sign-out-button";
import { getHotelContent } from "@/lib/hotel-content";

export async function VelouraAccountShell({
  children,
  slug,
  store,
  membership,
  unreadMessageCount,
}: {
  children: React.ReactNode;
  slug: string;
  store: any;
  membership: any;
  unreadMessageCount: number;
}) {
  const name = membership?.user?.name || membership?.user?.email || "Guest";
  const links = [
    { href: `/store/${slug}/account`, label: "My Account", icon: UserRound },
    { href: `/store/${slug}/account/bookings`, label: "My Bookings", icon: CalendarDays },
    { href: `/store/${slug}/account/wishlist`, label: "Saved Rooms", icon: Heart },
    { href: `/store/${slug}/account/wallet`, label: "Payments", icon: WalletCards },
    { href: `/store/${slug}/account/loyalty`, label: "Rewards", icon: Star },
    { href: `/store/${slug}/account/messages`, label: "Messages", icon: MessageCircle, badge: unreadMessageCount },
    { href: `/store/${slug}/account/messages`, label: "Support", icon: Headphones },
  ];
  const colors = (store.themeColors ?? {}) as Record<string, string>;
  const accent = colors.accent || colors.primary || "#c9953e";
  const location = [store.city, store.state, store.country].filter(Boolean).join(", ") || "";
  const hotelContent = await getHotelContent(slug);
  const heroImage = hotelContent.rooms.find((room) => room.featured)?.image || hotelContent.rooms[0]?.image || null;

  return (
    <div className="veloura-account" style={{ "--veloura-accent": accent } as React.CSSProperties}>
      <header className="veloura-account-topbar">
        <div className="veloura-account-location">⌖ {store.businessDescription ? "" : ""} {location}</div>
        <div className="veloura-account-toplinks">
          {store.contactPhone && <span>⌕ {store.contactPhone}</span>}
          {store.contactEmail && <span>✉ {store.contactEmail}</span>}
          <span>◎ EN⌄</span>
        </div>
      </header>
      <header className="veloura-account-header">
        <Link href={`/store/${slug}`} className="veloura-account-brand">
          {store.logoUrl ? <img src={store.logoUrl} alt={store.name} /> : <span className="veloura-account-brand-mark">◇</span>}
          <span>{store.name}</span>
        </Link>
        <nav className="veloura-account-mainnav">
          <Link href={`/store/${slug}`}>Home</Link>
          <Link href={`/store/${slug}/rooms`}>Rooms</Link>
          <Link href={`/store/${slug}/dining`}>Dining</Link>
          <Link href={`/store/${slug}/amenities`}>Amenities</Link>
          <Link href={`/store/${slug}/events`}>Events</Link>
          <Link href={`/store/${slug}/gallery`}>Gallery</Link>
          <Link href={`/store/${slug}/offers`}>Offers</Link>
          <Link href={`/store/${slug}/contact`}>Contact</Link>
        </nav>
        <div className="veloura-account-header-actions">
          <Search size={19} />
          <Link href={`/store/${slug}/account`} className="veloura-account-user-chip">
            <UserRound size={16} />
            <span><b>{name}</b><small>My Account⌄</small></span>
          </Link>
          <Link href={`/store/${slug}/rooms`} className="veloura-account-book-now">Book Now <span>→</span></Link>
        </div>
      </header>
      <div className="veloura-account-body">
        <aside className="veloura-account-sidebar">
          <div className="veloura-account-sidebar-profile">
            <div className="veloura-account-sidebar-avatar"><UserRound size={48} /></div>
            <strong>{name}</strong>
            <span>Guest</span>
            <small>✦ Guest Account</small>
          </div>
          <nav>
            {links.map(({ href, label, icon: Icon, badge }) => (
              <Link key={label} href={href} className="veloura-account-side-link">
                <Icon size={18} /><span>{label}</span>{badge ? <b>{badge > 9 ? "9+" : badge}</b> : null}
              </Link>
            ))}
          </nav>
          <div className="veloura-account-sidebar-promo" style={heroImage ? { backgroundImage: `linear-gradient(180deg,rgba(0,0,0,.08),rgba(0,0,0,.4)),url(${heroImage})` } : undefined}>
            <span>More Than a Stay</span>
            <strong>A Better You</strong>
            <Link href={`/store/${slug}/offers`}>Explore Our Offers →</Link>
          </div>
          <SignOutButton callbackUrl={`/store/${slug}`} className="veloura-account-logout"><LogOut size={17} /> Log Out</SignOutButton>
        </aside>
        <main className="veloura-account-main">{children}</main>
      </div>
      <footer className="veloura-account-footer">
        <div className="veloura-footer-brand">
          {store.logoUrl ? <img src={store.logoUrl} alt={store.name} /> : <span>◇</span>}
          <strong>{store.name}</strong>
          <p>Luxury Redefined. Moments That Matter.</p>
          <div>◎　f　𝕏　in　▶</div>
        </div>
        <div><h4>Quick Links</h4><Link href={`/store/${slug}`}>Home</Link><Link href={`/store/${slug}/rooms`}>Rooms</Link><Link href={`/store/${slug}/dining`}>Dining</Link><Link href={`/store/${slug}/amenities`}>Amenities</Link><Link href={`/store/${slug}/events`}>Events</Link><Link href={`/store/${slug}/offers`}>Offers</Link><Link href={`/store/${slug}/contact`}>Contact</Link></div>
        <div><h4>Guest Services</h4><Link href={`/store/${slug}/account/bookings`}>My Bookings</Link><Link href={`/store/${slug}/account/messages`}>Special Requests</Link><Link href={`/store/${slug}/contact`}>Airport Transfers</Link><Link href={`/store/${slug}/contact`}>Concierge</Link><Link href={`/store/${slug}/contact`}>FAQ</Link><span>Terms & Conditions</span><span>Privacy Policy</span></div>
        <div><h4>Contact Information</h4><span>⌖ {location || "—"}</span><span>⌕ {store.contactPhone || "—"}</span><span>✉ {store.contactEmail || "—"}</span><span>◷ 24/7 Front Desk</span></div>
        <div><h4>Join Our Newsletter</h4><span>Get exclusive offers and updates.</span><div className="veloura-newsletter"><input placeholder="Your email address" /><button>→</button></div></div>
        <div className="veloura-footer-bottom">© 2026 {store.name}. All rights reserved.<span>A Higher Standard of Hospitality.</span></div>
      </footer>
    </div>
  );
}
