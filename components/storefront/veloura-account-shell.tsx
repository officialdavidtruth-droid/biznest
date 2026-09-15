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
    <section className="bn-account-hero" style={image ? { backgroundImage: `linear-gradient(105deg, rgba(4,31,25,.94) 0%, rgba(4,31,25,.78) 48%, rgba(4,31,25,.30) 100%), url(${image})` } : undefined}>
      <div className="bn-account-hero-copy">
        <span className="bn-account-eyebrow">MY ACCOUNT</span>
        <h1>{title}</h1>
        <p>{subtitle}</p>
      </div>
      <div className="bn-account-hero-mark" aria-hidden="true">
        <span>Luxury</span>
        <strong>Redefined.</strong>
        <em>Moments That Matter.</em>
      </div>
    </section>
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
    "--account-accent": accent,
    "--account-forest": colors.primary || "#073b2e",
    "--account-page": colors.background || "#f4f6f4",
  } as React.CSSProperties;

  return (
    <div className="bn-account-shell" style={css}>
      <header className="bn-account-header">
        <div className="bn-account-header-inner">
          <Link href={`/store/${slug}`} className="bn-account-back" aria-label={`Back to ${store.name}`}>
            <ArrowLeft size={19} />
          </Link>
          <Link href={`/store/${slug}`} className="bn-account-brand">
            <span className="bn-account-brand-mark">
              {store.logoUrl ? <img src={store.logoUrl} alt="" /> : <span>{store.name?.slice(0, 1).toUpperCase() || <UserRound size={18} />}</span>}
            </span>
            <span className="bn-account-brand-copy">
              <strong>{store.name}</strong>
              <small>Guest account</small>
            </span>
          </Link>
          <div className="bn-account-header-actions">
            <span className="bn-account-signed-in">Signed in as <strong>{user.email}</strong></span>
            <Link href={`/store/${slug}`}><ExternalLink size={16} /> View website</Link>
          </div>
        </div>
      </header>

      <div className="bn-account-layout">
        <aside className="bn-account-sidebar">
          <div className="bn-account-user-card">
            <div className="bn-account-user-avatar">
              {user.image ? <img src={user.image} alt="" /> : <span>{(user.name || user.email || "G").slice(0, 1).toUpperCase()}</span>}
            </div>
            <div className="bn-account-user-copy">
              <strong>{user.name || "Guest"}</strong>
              <span>{user.email}</span>
            </div>
          </div>
          <VelouraAccountNav slug={slug} unread={unread} />
          <div className="bn-account-sidebar-note">
            <span>Need help?</span>
            <strong>Our team is here for you.</strong>
            <Link href={`/store/${slug}/account/support`}>Contact support <span>→</span></Link>
          </div>
        </aside>

        <main className="bn-account-main">{children}</main>
      </div>

      <footer className="bn-account-footer">
        <div className="bn-account-footer-inner">
          <div className="bn-account-footer-brand">
            <span>{store.name}</span>
            <p>{store.businessDescription || "A thoughtful stay, from booking to checkout."}</p>
          </div>
          <div className="bn-account-footer-links">
            <Link href={`/store/${slug}/account/bookings`}>Bookings</Link>
            <Link href={`/store/${slug}/account/messages`}>Messages</Link>
            <Link href={`/store/${slug}/account/support`}>Support</Link>
            <Link href={`/store/${slug}`}>Website</Link>
          </div>
          <div className="bn-account-footer-contact">
            {hotelAddress && <span><MapPin size={14}/>{hotelAddress}</span>}
            {store.contactPhone && <span><Phone size={14}/>{store.contactPhone}</span>}
            {store.contactEmail && <span><Mail size={14}/>{store.contactEmail}</span>}
            <span><Clock3 size={14}/>Front desk available 24/7</span>
          </div>
        </div>
        <div className="bn-account-footer-bottom">
          <span>© {new Date().getFullYear()} {store.name}. All rights reserved.</span>
          <span>Powered by BizNest</span>
        </div>
      </footer>
    </div>
  );
}
