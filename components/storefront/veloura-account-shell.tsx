import type React from "react";
import Link from "next/link";
import { ArrowLeft, ExternalLink, MapPin, Phone, Mail, Clock3, UserRound } from "lucide-react";
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
  return (
    <div
      className="veloura-account-hero"
      style={image ? { backgroundImage: `url(${image})` } : undefined}
    >
      <div>
        <p>My Account</p>
        <h1>{title}</h1>
        <div className="veloura-account-hero-subtitle">{subtitle}</div>
      </div>
      <span>Luxury<br />Redefined.<br /><em>Moments That Matter.</em></span>
    </div>
  );
}

export async function VelouraAccountShell({ children, slug, store: passedStore, membership: passedMembership }: {
  children: React.ReactNode;
  slug: string;
  active?: VelouraAccountPage;
  store?: any;
  membership?: any;
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
  const accent = colors.accent || colors.primary || "#b88b4a";
  const user = membership.user;
  const address = overview?.defaultAddress;
  const location = [address?.city, address?.state, address?.country].filter(Boolean).join(", ");
  const hotelContact = hotel.contact as any;
  const hotelAddress = [hotelContact?.address, hotelContact?.city, hotelContact?.state, hotelContact?.country].filter(Boolean).join(", ") || location;
  const css = {
    "--veloura-accent": accent,
    "--veloura-bg": colors.background || "#f6f8f6",
    "--veloura-forest": colors.primary || "#073b2e",
  } as React.CSSProperties;

  return (
    <div className="veloura-account" style={css}>
      <header className="veloura-account-header">
        <div className="veloura-account-header-inner">
          <Link href={`/store/${slug}`} className="veloura-account-back" aria-label="Back to hotel website">
            <ArrowLeft size={18} />
          </Link>
          <Link href={`/store/${slug}`} className="veloura-account-identity">
            <span className="veloura-account-logo">
              {store.logoUrl ? <img src={store.logoUrl} alt="" /> : <UserRound size={18} />}
            </span>
            <span>
              <strong>MY {store.name.toUpperCase()} ACCOUNT</strong>
              <small>Signed in as {user.email}</small>
            </span>
          </Link>
          <div className="veloura-account-header-actions">
            <Link href={`/store/${slug}`}><ExternalLink size={16} /> <span>View website</span></Link>
          </div>
        </div>
      </header>

      <div className="veloura-account-body">
        <aside className="veloura-sidebar">
          <div className="veloura-profile-mini">
            <div className="veloura-avatar">
              {user.image ? <img src={user.image} alt="" /> : <span>{(user.name || user.email || "G").slice(0, 1).toUpperCase()}</span>}
            </div>
            <div>
              <h2>{user.name || "Guest"}</h2>
              <p>{user.email}</p>
              <strong>Guest account</strong>
            </div>
          </div>
          <VelouraAccountNav slug={slug} unread={unread} />
        </aside>

        <main className="veloura-account-main">{children}</main>
      </div>

      <footer className="veloura-footer">
        <div className="veloura-footer-grid">
          <div>
            <div className="veloura-footer-brand">
              {store.logoUrl ? <img src={store.logoUrl} alt={store.name} /> : <span>✦</span>}
              <strong>{store.name}</strong>
            </div>
            <p>{store.businessDescription || "A thoughtful stay, from booking to checkout."}</p>
          </div>
          <div>
            <h4>Guest Services</h4>
            <Link href={`/store/${slug}/account/bookings`}>My Bookings</Link>
            <Link href={`/store/${slug}/account/messages`}>Messages</Link>
            <Link href={`/store/${slug}/account/support`}>Support</Link>
          </div>
          <div>
            <h4>Contact</h4>
            {hotelAddress && <p><MapPin /> {hotelAddress}</p>}
            {store.contactPhone && <p><Phone /> {store.contactPhone}</p>}
            {store.contactEmail && <p><Mail /> {store.contactEmail}</p>}
            <p><Clock3 /> 24/7 Front Desk</p>
          </div>
        </div>
        <div className="veloura-footer-bottom">
          <span>© {new Date().getFullYear()} {store.name}. All rights reserved.</span>
          <span>Your account is protected by BizNest.</span>
        </div>
      </footer>
    </div>
  );
}
