"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { CalendarDays, Heart, WalletCards, Star, MessageCircle, Headphones, LogOut, UserRound, Settings2, LayoutDashboard, Package, MapPin, Bell, Wallet } from "lucide-react";
import { SignOutButton } from "@/components/forms/sign-out-button";

type NavItem = {
  key: string;
  label: string;
  href: string;
  iconKey: keyof typeof ICONS;
  badge?: number;
};

const ICONS = { UserRound, CalendarDays, Heart, Star, WalletCards, Settings2, MessageCircle, Headphones, LayoutDashboard, Package, MapPin, Bell, Wallet };

export function VelouraAccountNav({
  slug,
  unread = 0,
  links,
}: {
  slug: string;
  unread?: number;
  links?: NavItem[];
}) {
  const path = usePathname() || "";
  const defaultLinks: NavItem[] = [
    { key: "account", label: "Overview", iconKey: "UserRound", href: `/store/${slug}/account` },
    { key: "bookings", label: "My Bookings", iconKey: "CalendarDays", href: `/store/${slug}/account/bookings` },
    { key: "wishlist", label: "Saved Rooms", iconKey: "Heart", href: `/store/${slug}/account/wishlist` },
    { key: "rewards", label: "Rewards", iconKey: "Star", href: `/store/${slug}/account/loyalty` },
    { key: "payments", label: "Wallet & Payments", iconKey: "WalletCards", href: `/store/${slug}/account/wallet` },
    { key: "preferences", label: "Preferences", iconKey: "Settings2", href: `/store/${slug}/account/preferences` },
    { key: "messages", label: "Messages", iconKey: "MessageCircle", href: `/store/${slug}/account/messages`, badge: unread },
    { key: "support", label: "Help & Support", iconKey: "Headphones", href: `/store/${slug}/account/support` },
  ];
  const items = links ?? defaultLinks;

  return (
    <nav className="bn-account-nav" aria-label="Account navigation">
      <p className="bn-account-nav-label">ACCOUNT</p>
      <div className="bn-account-nav-list">
        {items.map(({ key, label, iconKey, href, badge }) => {
          const active = key === "account" ? path === href : path === href || path.startsWith(`${href}/`);
          return (
            <Link
              key={key}
              href={href}
              className={active ? "active" : ""}
              aria-current={active ? "page" : undefined}
            >
              <span className="bn-account-nav-icon">{(() => { const Icon = ICONS[iconKey]; return <Icon size={18} strokeWidth={1.8} />; })()}</span>
              <span className="bn-account-nav-text">{label}</span>
              {badge && badge > 0 ? <b aria-label={`${badge} unread messages`}>{badge > 9 ? "9+" : badge}</b> : null}
            </Link>
          );
        })}
      </div>
      <div className="bn-account-nav-divider" />
      <SignOutButton callbackUrl={`/store/${slug}`} className="bn-account-logout">
        <span className="bn-account-nav-icon"><LogOut size={18} strokeWidth={1.8} /></span>
        <span className="bn-account-nav-text">Sign out</span>
      </SignOutButton>
    </nav>
  );
}

