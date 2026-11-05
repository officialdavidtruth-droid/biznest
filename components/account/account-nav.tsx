"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { CalendarDays, Gift, Heart, LayoutDashboard, LogOut, MapPin, MessageCircle, Package, Share2, Star, Wallet, Sparkles } from "lucide-react";
import { SignOutButton } from "@/components/forms/sign-out-button";

const ICONS = { LayoutDashboard, Package, Heart, MapPin, Sparkles, Share2, Gift, Wallet, CalendarDays, Star, MessageCircle };

export type AccountNavLink = { key: string; label: string; href: string; iconKey: keyof typeof ICONS; group: "main" | "money" | "help"; badge?: number };

const GROUPS: { id: AccountNavLink["group"]; label: string }[] = [
  { id: "main", label: "Account" },
  { id: "money", label: "Money & rewards" },
  { id: "help", label: "Help" },
];

/** Grouped sidebar on desktop, one scrollable pill row on phones. */
export function AccountNav({ slug, links }: { slug: string; links: AccountNavLink[] }) {
  const path = usePathname() || "";
  const isActive = (l: AccountNavLink) => (l.key === "account" ? path === l.href : path === l.href || path.startsWith(`${l.href}/`));
  return (
    <nav className="acx-nav" aria-label="Account navigation">
      <div className="acx-nav-scroll">
        {GROUPS.map((g) => {
          const items = links.filter((l) => l.group === g.id);
          if (!items.length) return null;
          return (
            <div className="acx-nav-group" key={g.id}>
              <p className="acx-nav-label">{g.label}</p>
              {items.map((l) => {
                const Icon = ICONS[l.iconKey];
                const active = isActive(l);
                return (
                  <Link key={l.key} href={l.href} className={active ? "active" : ""} aria-current={active ? "page" : undefined}>
                    <Icon size={18} strokeWidth={1.9} />
                    <span>{l.label}</span>
                    {l.badge && l.badge > 0 ? <b className="acx-badge" aria-label={`${l.badge} unread`}>{l.badge > 9 ? "9+" : l.badge}</b> : null}
                  </Link>
                );
              })}
            </div>
          );
        })}
        <div className="acx-nav-group">
          <SignOutButton callbackUrl={`/store/${slug}`} className="acx-signout">
            <LogOut size={18} strokeWidth={1.9} />
            <span>Sign out</span>
          </SignOutButton>
        </div>
      </div>
    </nav>
  );
}
