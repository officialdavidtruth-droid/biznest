"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { CalendarDays, Heart, WalletCards, Star, MessageCircle, Headphones, LogOut, UserRound, Settings2 } from "lucide-react";
import { SignOutButton } from "@/components/forms/sign-out-button";

export function VelouraAccountNav({ slug, unread }: { slug: string; unread: number }) {
  const path = usePathname();
  const links = [
    ["account", "Overview", UserRound, `/store/${slug}/account`],
    ["bookings", "My Bookings", CalendarDays, `/store/${slug}/account/bookings`],
    ["wishlist", "Saved Rooms", Heart, `/store/${slug}/account/wishlist`],
    ["rewards", "Rewards", Star, `/store/${slug}/account/loyalty`],
    ["payments", "Wallet & Payments", WalletCards, `/store/${slug}/account/wallet`],
    ["preferences", "Preferences", Settings2, `/store/${slug}/account/preferences`],
    ["messages", "Messages", MessageCircle, `/store/${slug}/account/messages`],
    ["support", "Help & Support", Headphones, `/store/${slug}/account/support`],
  ] as const;

  return (
    <nav className="bn-account-nav" aria-label="Account navigation">
      <p className="bn-account-nav-label">ACCOUNT</p>
      {links.map(([key, label, Icon, href]) => {
        const active = key === "account" ? path === href : path?.startsWith(href);
        return (
          <Link key={key} href={href} className={active ? "active" : ""}>
            <Icon size={18} />
            <span>{label}</span>
            {key === "messages" && unread > 0 ? <b>{unread > 9 ? "9+" : unread}</b> : null}
          </Link>
        );
      })}
      <div className="bn-account-nav-divider" />
      <SignOutButton callbackUrl={`/store/${slug}`} className="bn-account-logout"><LogOut size={18} /><span>Sign out</span></SignOutButton>
    </nav>
  );
}
