"use client";

import { useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { Menu, X, ExternalLink } from "lucide-react";
import { buildNavGroups, buildBottomTabItems, filterNavGroupsForRole } from "@/lib/constants/dashboard-nav";
import type { StoreAccessRole } from "@/lib/access/store-access";
import { NotificationBell } from "@/components/dashboard/notification-bell";
import { PushSubscribePrompt } from "@/components/dashboard/push-subscribe-prompt";
import { ThemeToggle } from "@/components/theme/theme-toggle";
import { SignOutButton } from "@/components/forms/sign-out-button";
import { StoreLogo } from "@/components/dashboard/store-logo";

type NotificationItem = {
  id: string;
  title: string;
  body: string;
  url: string | null;
  readAt: Date | null;
  createdAt: Date;
};

/**
 * Mobile-primary dashboard chrome (< lg breakpoint; hidden entirely at lg
 * and up, where DashboardSidebar takes over). Rendered once, but its two
 * halves position independently via CSS rather than wrapping page content:
 *  - Top bar: sticky, in normal flow — hamburger (opens the full nav
 *    drawer) + store name + notification bell.
 *  - Bottom tab bar: `fixed` to the viewport bottom (the one-thumb reach
 *    zone on a phone) with safe-area padding for phones with a gesture
 *    bar — the 4 highest-frequency destinations plus a Menu tab.
 * Because the bottom bar is fixed rather than a flex sibling after
 * {children}, the admin layout only has to render page content once and
 * give it bottom padding to clear it — see app/store/[slug]/admin/layout.tsx.
 */
export function MobileDashboardChrome({
  slug,
  storeName,
  logoUrl,
  sellsProducts,
  offersServices,
  category,
  notifications,
  unreadCount,
  staffRole,
  staffPermissions,
  staffPosition,
  subscriptionName,
}: {
  slug: string;
  storeName: string;
  logoUrl?: string | null;
  sellsProducts: boolean;
  offersServices: boolean;
  category?: string | null;
  notifications: NotificationItem[];
  unreadCount: number;
  staffRole?: StoreAccessRole;
  staffPermissions?: string[] | null;
  subscriptionName?: string | null;
  // Only set for staff who signed in with "Position@store" (see
  // authorize() in lib/auth.ts) — shown next to the store name so it's
  // clear which title they're signed in under, e.g. "Cashier - Velox Space".
  staffPosition?: string | null;
}) {
  const [drawerOpen, setDrawerOpen] = useState(false);
  const pathname = usePathname();
  const base = `/${slug}/admin`;
  const business = { sellsProducts, offersServices, category, subscriptionName };
  const canManageOwnerOnly = staffRole === undefined || staffRole === "OWNER" || staffRole === "PLATFORM_STAFF";
  const navGroups = filterNavGroupsForRole(buildNavGroups(business), {
    canManageOwnerOnly,
    permissions: staffPermissions,
  });
  const bottomItems = buildBottomTabItems(business, { canManageOwnerOnly, permissions: staffPermissions });

  return (
    <div className="lg:hidden">
      {/* Top bar */}
      <header className="sticky top-0 z-30 flex items-center justify-between border-b border-border bg-background px-3 py-2.5">
        <div className="flex min-w-0 items-center gap-2">
          <button
            onClick={() => setDrawerOpen(true)}
            aria-label="Open menu"
            className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full hover:bg-muted"
          >
            <Menu className="h-5 w-5" />
          </button>
          <StoreLogo logoUrl={logoUrl} storeName={storeName} size="sm" />
          <p className="truncate text-sm font-semibold">
            {staffPosition ? `${staffPosition} - ${storeName}` : storeName}
          </p>
        </div>
        <div className="flex items-center gap-1">
          <ThemeToggle />
          <NotificationBell notifications={notifications} unreadCount={unreadCount} />
        </div>
      </header>

      <PushSubscribePrompt />

      {/* Bottom tab bar — fixed, so it stays put while page content scrolls */}
      <nav
        className="fixed inset-x-0 bottom-0 z-30 grid border-t border-border bg-background pb-[env(safe-area-inset-bottom)]"
        style={{ gridTemplateColumns: `repeat(${bottomItems.length + 1}, minmax(0, 1fr))` }}
      >
        {bottomItems.map((item) => {
          const href = `${base}${item.href}`;
          const isActive = pathname === href;
          const Icon = item.icon;
          return (
            <Link
              key={item.label}
              href={href}
              className={`flex flex-col items-center gap-0.5 py-2 text-[10px] ${
                isActive ? "text-primary" : "text-muted-foreground"
              }`}
            >
              <Icon className={`h-5 w-5 ${isActive ? "" : "opacity-70"}`} />
              <span className="truncate px-0.5">{item.label}</span>
            </Link>
          );
        })}
        <button
          onClick={() => setDrawerOpen(true)}
          className="flex flex-col items-center gap-0.5 py-2 text-[10px] text-muted-foreground"
        >
          <Menu className="h-5 w-5 opacity-70" />
          <span>Menu</span>
        </button>
      </nav>

      {/* Slide-in drawer with the full nav — same buildNavGroups the desktop sidebar uses */}
      {drawerOpen && (
        <div className="fixed inset-0 z-40">
          <div className="absolute inset-0 bg-black/50" onClick={() => setDrawerOpen(false)} />
          <div className="absolute inset-y-0 left-0 flex w-[82%] max-w-xs flex-col overflow-y-auto bg-background pb-[env(safe-area-inset-bottom)]">
            <div className="flex items-center gap-3 border-b border-border px-4 py-4">
              <StoreLogo logoUrl={logoUrl} storeName={storeName} />
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-semibold leading-tight">{storeName}</p>
                <Link
                  href={`/${slug}`}
                  className="mt-0.5 flex items-center gap-1 truncate text-xs text-muted-foreground"
                  onClick={() => setDrawerOpen(false)}
                >
                  <span className="truncate">biznest.space/{slug}</span>
                  <ExternalLink className="h-3 w-3 shrink-0" />
                </Link>
              </div>
              <button onClick={() => setDrawerOpen(false)} aria-label="Close menu" className="shrink-0 p-1">
                <X className="h-5 w-5" />
              </button>
            </div>
            <div className="flex-1 space-y-5 px-3 py-4">
              {navGroups.map((group) => (
                <div key={group.label}>
                  <p className="mb-1.5 px-2 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground/70">
                    {group.label}
                  </p>
                  <div className="space-y-0.5">
                    {group.items.map((item) => {
                      const href = `${base}${item.href}`;
                      const isActive = pathname === href;
                      const Icon = item.icon;
                      return (
                        <Link
                          key={item.label}
                          href={href}
                          onClick={() => setDrawerOpen(false)}
                          className={`flex items-center gap-2.5 rounded-lg px-2.5 py-2.5 text-sm ${
                            isActive ? "bg-primary/15 font-medium text-primary" : "text-muted-foreground"
                          }`}
                        >
                          <Icon className="h-4 w-4 shrink-0" />
                          <span className="truncate">{item.label}</span>
                        </Link>
                      );
                    })}
                  </div>
                </div>
              ))}
            </div>
            <div className="space-y-2 border-t border-border px-4 py-3">
              <Link href={`/${slug}`} className="block text-xs font-medium text-muted-foreground">
                View live store →
              </Link>
              <SignOutButton className="text-xs font-medium text-muted-foreground" />
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
