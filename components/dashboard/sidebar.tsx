"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { ExternalLink, Pencil } from "lucide-react";
import { buildNavGroups, filterNavGroupsForRole } from "@/lib/constants/dashboard-nav";
import type { StoreAccessRole } from "@/lib/access/store-access";
import { SignOutButton } from "@/components/forms/sign-out-button";
import { StoreLogo } from "@/components/dashboard/store-logo";

export function DashboardSidebar({
  slug,
  storeName,
  logoUrl,
  sellsProducts,
  offersServices,
  category,
  staffRole,
  staffPermissions,
}: {
  slug: string;
  storeName: string;
  logoUrl?: string | null;
  // What this business does — controls which "Sell" items appear. Both
  // default true/false-safe (a hybrid store just passes both true).
  sellsProducts: boolean;
  offersServices: boolean;
  // The category chosen at onboarding — adds one trade-specific nav item.
  category?: string | null;
  // Undefined/OWNER/PLATFORM_STAFF shows everything; MANAGER/STAFF hides
  // billing + staff-management links (see filterNavGroupsForRole) and,
  // via staffPermissions, anything they weren't individually granted.
  staffRole?: StoreAccessRole;
  staffPermissions?: string[] | null;
}) {
  const pathname = usePathname();
  const base = `/store/${slug}/admin`;
  const canManageOwnerOnly = staffRole === undefined || staffRole === "OWNER" || staffRole === "PLATFORM_STAFF";
  const NAV_GROUPS = filterNavGroupsForRole(buildNavGroups({ sellsProducts, offersServices, category }), {
    canManageOwnerOnly,
    permissions: staffPermissions,
  });

  return (
    // Desktop/tablet only — below lg, MobileDashboardChrome (top bar +
    // drawer + bottom tab bar) is the primary nav. This isn't the same
    // component squeezed into a hamburger; mobile gets its own layout
    // tuned for one-thumb use, not a shrunk desktop sidebar.
    <aside className="hidden h-full w-64 shrink-0 flex-col border-r border-border bg-background lg:flex">
      <div className="flex items-center gap-3 border-b border-border px-4 py-4">
        <Link
          href={`${base}/settings`}
          className="group/logo relative shrink-0 rounded-xl"
          title="Change store logo"
        >
          <StoreLogo logoUrl={logoUrl} storeName={storeName} />
          <span className="absolute inset-0 flex items-center justify-center rounded-xl bg-black/50 opacity-0 transition-opacity group-hover/logo:opacity-100">
            <Pencil className="h-3.5 w-3.5 text-white" />
          </span>
        </Link>
        <Link href={`/${slug}`} target="_blank" className="group/link min-w-0 flex-1">
          <p className="truncate text-sm font-semibold leading-tight transition-colors group-hover/link:text-primary">
            {storeName}
          </p>
          <p className="mt-0.5 flex items-center gap-1.5 truncate text-xs text-muted-foreground">
            <span className="h-1.5 w-1.5 shrink-0 rounded-full bg-emerald-500" />
            <span className="truncate">biznest.space/{slug}</span>
            <ExternalLink className="h-3 w-3 shrink-0 opacity-0 transition-opacity group-hover/link:opacity-100" />
          </p>
        </Link>
      </div>

      <nav className="flex-1 space-y-5 overflow-y-auto px-3 py-4">
        {NAV_GROUPS.map((group) => (
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
                    className={`group relative flex items-center gap-2.5 rounded-lg px-2.5 py-2 text-sm transition-colors ${
                      isActive
                        ? "bg-primary/15 font-medium text-primary"
                        : "text-muted-foreground hover:bg-muted hover:text-foreground"
                    }`}
                  >
                    {isActive && (
                      <span className="absolute -left-3 top-1/2 h-4 w-0.5 -translate-y-1/2 rounded-full bg-primary" />
                    )}
                    <Icon className={`h-4 w-4 shrink-0 ${isActive ? "" : "opacity-70 group-hover:opacity-100"}`} />
                    <span className="truncate">{item.label}</span>
                  </Link>
                );
              })}
            </div>
          </div>
        ))}
      </nav>

      <div className="space-y-2 border-t border-border px-4 py-3">
        <Link href={`/${slug}`} className="block text-xs font-medium text-muted-foreground hover:text-primary">
          View live store →
        </Link>
        <SignOutButton className="text-xs font-medium text-muted-foreground hover:text-destructive" />
      </div>
    </aside>
  );
}
