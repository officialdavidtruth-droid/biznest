"use client";

import Link from "next/link";
import { useState } from "react";
import { usePathname } from "next/navigation";
import { ExternalLink, Pencil, Crown, ChevronDown } from "lucide-react";
import { buildNavGroups, filterNavGroupsForRole, type NavItem } from "@/lib/constants/dashboard-nav";
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
  subscriptionName,
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
  subscriptionName?: string | null;
}) {
  const pathname = usePathname();
  const base = `/${slug}/admin`;
  const canManageOwnerOnly = staffRole === undefined || staffRole === "OWNER" || staffRole === "PLATFORM_STAFF";
  const NAV_GROUPS = filterNavGroupsForRole(buildNavGroups({ sellsProducts, offersServices, category, subscriptionName }), {
    canManageOwnerOnly,
    permissions: staffPermissions,
  });

  return (
    // Desktop/tablet only — below lg, MobileDashboardChrome (top bar +
    // drawer + bottom tab bar) is the primary nav. This isn't the same
    // component squeezed into a hamburger; mobile gets its own layout
    // tuned for one-thumb use, not a shrunk desktop sidebar.
    <aside className="bn-admin-sidebar hidden w-[250px] shrink-0 flex-col border-r border-[color:var(--bn-ink-line)] bg-[color:var(--bn-ink)] text-white lg:sticky lg:top-0 lg:flex lg:self-start">
      <div className="border-b border-slate-800 px-4 py-4">
        <div className="mb-4 flex items-center gap-2.5">
          <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-[#10967a] text-sm font-black text-white shadow-sm">▰</div>
          <div>
            <p className="text-[19px] font-bold leading-none tracking-tight text-white">BizNest</p>
            <p className="mt-1 text-[9px] font-medium tracking-wide text-slate-400">Your Business, Elevated</p>
          </div>
        </div>
        <div className="rounded-xl border border-slate-700 bg-slate-900/80 p-3">
          <div className="flex items-center gap-2.5">
            <Link href={`${base}/settings`} className="group/logo relative shrink-0 rounded-lg" title="Change business logo">
              <StoreLogo logoUrl={logoUrl} storeName={storeName} size="sm" />
              <span className="absolute inset-0 flex items-center justify-center rounded-lg bg-black/50 opacity-0 transition-opacity group-hover/logo:opacity-100">
                <Pencil className="h-3.5 w-3.5 text-white" />
              </span>
            </Link>
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-1.5">
                <p className="truncate text-xs font-semibold text-white">{storeName}</p>
                <span className="h-1.5 w-1.5 shrink-0 rounded-full bg-emerald-400" />
              </div>
              <Link href={`/${slug}`} target="_blank" className="mt-1 flex items-center gap-1 text-[10px] text-slate-400 hover:text-white">
                <span>View Store</span><ExternalLink className="h-2.5 w-2.5" />
              </Link>
            </div>
            <ChevronDown className="h-4 w-4 text-slate-500" />
          </div>
        </div>
      </div>

      <nav className="space-y-5 px-3 py-4">
        {NAV_GROUPS.map((group) => (
          <div key={group.label}>
            <p className="mb-1.5 px-2 text-[10px] font-semibold uppercase tracking-wider text-slate-500">
              {group.label}
            </p>
            <div className="space-y-0.5">
              {group.items.map((item) => (
                <NavLink key={item.label} base={base} item={item} pathname={pathname} />
              ))}
            </div>
          </div>
        ))}
      </nav>

      <div className="border-t border-slate-800 px-3 py-3">
        <div className="mb-3 rounded-xl border border-slate-700 bg-slate-900/80 p-3">
          <div className="flex items-center gap-2 text-[11px] font-semibold text-white"><Crown className="h-4 w-4 text-[#10967a]" /> BizNest Pro Plan</div>
          <p className="mt-1 text-[10px] text-slate-400">Your workspace is powered by BizNest.</p>
          <div className="my-2 h-1.5 overflow-hidden rounded-full bg-slate-700"><div className="h-full w-[76%] rounded-full bg-[#10967a]" /></div>
          <Link href={`/${slug}/admin/subscription`} className="block rounded-md bg-[#10967a] px-2 py-1.5 text-center text-[10px] font-bold text-white">Manage Plan</Link>
        </div>
        <div className="flex items-center gap-2 px-1">
          <StoreLogo logoUrl={logoUrl} storeName={storeName} size="sm" />
          <div className="min-w-0 flex-1"><p className="truncate text-[11px] font-semibold text-white">Business Admin</p><p className="text-[10px] text-slate-500">{staffRole ?? "OWNER"}</p></div>
          <SignOutButton className="text-[10px] text-slate-400 hover:text-red-300" />
        </div>
      </div>
    </aside>
  );
}

function NavLink({ base, item, pathname }: { base: string; item: NavItem; pathname: string | null }) {
  const href = `${base}${item.href}`;
  const isActive = pathname === href;
  const childActive = item.children?.some((c) => pathname === `${base}${c.href}`) ?? false;
  const [open, setOpen] = useState(childActive);
  const Icon = item.icon;

  if (!item.children || item.children.length === 0) {
    // The PMS app switches to an entirely different persistent shell (no
    // sidebar, its own dark theme) via a conditional branch inside the
    // shared admin layout.tsx. Next.js App Router layouts persist across
    // client-side navigations to sibling routes by design (they don't
    // re-run just because the destination page differs), so a soft <Link>
    // nav here can leave the old sidebar-shell mounted with the PMS page's
    // own content rendered inside it — the double-sidebar bug. A plain
    // <a> forces a full document load, which always re-evaluates the
    // layout fresh. See app/store/[slug]/admin/layout.tsx's isPmsRoute.
    if (item.href === "/pms") {
      return (
        <a
          href={href}
          className={`group relative flex items-center gap-2.5 rounded-lg px-2.5 py-2 text-sm transition-colors ${
            isActive ? "bg-[#10967a] font-medium text-white shadow-sm" : "text-slate-300 hover:bg-white/8 hover:text-white"
          }`}
        >
          {isActive && <span className="absolute -left-3 top-1/2 h-4 w-0.5 -translate-y-1/2 rounded-full bg-primary" />}
          <Icon className={`h-4 w-4 shrink-0 ${isActive ? "" : "opacity-70 group-hover:opacity-100"}`} />
          <span className="truncate">{item.label}</span>
        </a>
      );
    }
    return (
      <Link
        href={href}
        className={`group relative flex items-center gap-2.5 rounded-lg px-2.5 py-2 text-sm transition-colors ${
          isActive ? "bg-[#10967a] font-medium text-white shadow-sm" : "text-slate-300 hover:bg-white/8 hover:text-white"
        }`}
      >
        {isActive && <span className="absolute -left-3 top-1/2 h-4 w-0.5 -translate-y-1/2 rounded-full bg-primary" />}
        <Icon className={`h-4 w-4 shrink-0 ${isActive ? "" : "opacity-70 group-hover:opacity-100"}`} />
        <span className="truncate">{item.label}</span>
      </Link>
    );
  }

  return (
    <div>
      <div
        className={`group relative flex items-center gap-2.5 rounded-lg pr-1.5 text-sm transition-colors ${
          isActive ? "bg-[#10967a] font-medium text-white shadow-sm" : "text-slate-300 hover:bg-white/8 hover:text-white"
        }`}
      >
        {isActive && <span className="absolute -left-3 top-1/2 h-4 w-0.5 -translate-y-1/2 rounded-full bg-primary" />}
        <Link href={href} className="flex flex-1 items-center gap-2.5 px-2.5 py-2">
          <Icon className={`h-4 w-4 shrink-0 ${isActive ? "" : "opacity-70 group-hover:opacity-100"}`} />
          <span className="truncate">{item.label}</span>
        </Link>
        <button
          type="button"
          onClick={() => setOpen((v) => !v)}
          className="grid h-6 w-6 shrink-0 place-items-center rounded-md hover:bg-black/10"
          aria-label={open ? "Collapse" : "Expand"}
        >
          <ChevronDown className={`h-3.5 w-3.5 transition-transform ${open ? "rotate-180" : ""}`} />
        </button>
      </div>
      {open && (
        <div className="ml-4 mt-0.5 space-y-0.5 border-l border-slate-700 pl-3">
          {item.children.map((child) => {
            const childHref = `${base}${child.href}`;
            const childIsActive = pathname === childHref;
            const ChildIcon = child.icon;
            return (
              <Link
                key={child.label}
                href={childHref}
                className={`flex items-center gap-2 rounded-lg px-2.5 py-1.5 text-xs transition-colors ${
                  childIsActive ? "bg-[#10967a]/90 font-medium text-white" : "text-slate-400 hover:bg-white/8 hover:text-white"
                }`}
              >
                <ChildIcon className="h-3.5 w-3.5 shrink-0 opacity-70" />
                <span className="truncate">{child.label}</span>
              </Link>
            );
          })}
        </div>
      )}
    </div>
  );
}
