"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { ExternalLink, Pencil, ChevronDown, Crown } from "lucide-react";
import { buildNavGroups, filterNavGroupsForRole, type NavItem } from "@/lib/constants/dashboard-nav";
import type { StoreAccessRole } from "@/lib/access/store-access";
import { SignOutButton } from "@/components/forms/sign-out-button";
import { StoreLogo } from "@/components/dashboard/store-logo";

function restaurantLabel(item: NavItem) {
  if (item.href === "/bookings") return "Reservations";
  if (item.href === "/products") return "Menu Management";
  if (item.href === "/staff") return "Staff Management";
  if (item.href === "/analytics") return "Analytics & Reports";
  return item.label;
}

function buildDisplayItems({
  sellsProducts,
  offersServices,
  category,
  subscriptionName,
}: {
  sellsProducts: boolean;
  offersServices: boolean;
  category?: string | null;
  subscriptionName?: string | null;
}) {
  const groups = buildNavGroups({ sellsProducts, offersServices, category, subscriptionName });
  const items = groups.flatMap((g) => g.items);
  const restaurant = category === "Restaurant";
  const desired = restaurant
    ? ["", "/bookings", "/orders", "/products", "/customers", "/inventory", "/staff", "/marketing", "/analytics", "/reviews", "/settings"]
    : ["", ...items.map((i) => i.href)];
  const seen = new Set<string>();
  const result: NavItem[] = [];
  for (const href of desired) {
    const item = items.find((i) => i.href === href);
    if (!item || seen.has(item.href)) continue;
    seen.add(item.href);
    result.push(restaurant ? { ...item, label: restaurantLabel(item) } : item);
  }
  if (restaurant) {
    const kitchen: NavItem = { label: "Kitchen Operations", href: "/orders?view=kitchen", icon: items.find((i) => i.href === "/orders")?.icon ?? items[0].icon };
    const ordersIndex = result.findIndex((i) => i.href === "/orders");
    if (ordersIndex >= 0 && !result.some((i) => i.href === kitchen.href)) result.splice(ordersIndex + 1, 0, kitchen);
  }
  return result;
}

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
  sellsProducts: boolean;
  offersServices: boolean;
  category?: string | null;
  staffRole?: StoreAccessRole;
  staffPermissions?: string[] | null;
  subscriptionName?: string | null;
}) {
  const pathname = usePathname();
  const base = `/${slug}/admin`;
  const canManageOwnerOnly = staffRole === undefined || staffRole === "OWNER" || staffRole === "PLATFORM_STAFF";
  const groups = filterNavGroupsForRole(buildNavGroups({ sellsProducts, offersServices, category, subscriptionName }), { canManageOwnerOnly, permissions: staffPermissions });
  const allAllowed = groups.flatMap((g) => g.items);
  const displayItems = buildDisplayItems({ sellsProducts, offersServices, category, subscriptionName }).filter((item) => allAllowed.some((x) => x.href === item.href));

  return (
    <aside className="hidden h-full w-[250px] shrink-0 flex-col bg-[#07101f] text-white lg:flex">
      <div className="border-b border-white/10 px-4 pb-4 pt-5">
        <Link href={`/${slug}`} className="flex items-center gap-2.5" target="_blank">
          <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-[#e9b45a] text-[#111827] shadow-sm"><span className="text-lg font-black">B</span></div>
          <div><div className="text-[20px] font-extrabold leading-none tracking-[-0.04em]">BizNest</div><div className="mt-1 text-[8px] font-medium tracking-[0.18em] text-white/55">YOUR BUSINESS, ELEVATED</div></div>
        </Link>
      </div>

      <div className="mx-3 mt-4 rounded-xl border border-white/10 bg-white/[0.055] p-3">
        <div className="flex items-center gap-2.5">
          <Link href={`${base}/settings`} className="group/logo relative shrink-0 rounded-lg" title="Change business logo">
            <StoreLogo logoUrl={logoUrl} storeName={storeName} size="sm" />
            <span className="absolute inset-0 flex items-center justify-center rounded-lg bg-black/50 opacity-0 transition-opacity group-hover/logo:opacity-100"><Pencil className="h-3.5 w-3.5 text-white" /></span>
          </Link>
          <div className="min-w-0 flex-1">
            <p className="truncate text-[12px] font-semibold text-white">{storeName}</p>
            <Link href={`/${slug}`} target="_blank" className="mt-1 flex items-center gap-1 text-[10px] text-white/55 hover:text-white"><span>View Store</span><ExternalLink className="h-3 w-3" /></Link>
          </div>
          <ChevronDown className="h-4 w-4 text-white/45" />
        </div>
      </div>

      <nav className="mt-4 flex-1 overflow-y-auto px-3 pb-4">
        <div className="space-y-1">
          {displayItems.map((item) => {
            const href = `${base}${item.href}`;
            const cleanHref = href.split("?")[0];
            const isActive = item.href === "" ? pathname === base || pathname === `${base}/` : pathname === cleanHref || pathname.startsWith(`${cleanHref}/`);
            const Icon = item.icon;
            return <Link key={`${item.href}-${item.label}`} href={href} className={`group relative flex items-center gap-3 rounded-lg px-3 py-2.5 text-[13px] transition-all ${isActive ? "bg-[#e9b45a] font-semibold text-[#111827] shadow-sm" : "text-white/72 hover:bg-white/[0.06] hover:text-white"}`}><Icon className={`h-[17px] w-[17px] shrink-0 ${isActive ? "text-[#111827]" : "text-white/65 group-hover:text-white"}`} /><span className="truncate">{item.label}</span>{item.href === "/pms" && <span className="ml-auto rounded bg-[#e9b45a]/15 px-1.5 py-0.5 text-[8px] font-bold text-[#e9b45a]">MOGUL</span>}</Link>;
          })}
        </div>
      </nav>

      <div className="mx-3 mb-3 rounded-xl border border-white/10 bg-white/[0.055] p-3">
        <div className="mb-2 flex items-center gap-2"><Crown className="h-4 w-4 text-[#e9b45a]" /><span className="text-[11px] font-bold">BizNest {subscriptionName || "Plan"}</span></div>
        <p className="text-[10px] leading-4 text-white/50">Your workspace adapts automatically to your business.</p>
        <Link href={`${base}/subscription`} className="mt-3 block rounded-lg bg-[#e9b45a] px-3 py-2 text-center text-[11px] font-bold text-[#111827]">Manage Plan</Link>
      </div>

      <div className="border-t border-white/10 px-4 py-3">
        <SignOutButton className="w-full text-left text-[11px] font-medium text-white/55 hover:text-white" />
      </div>
    </aside>
  );
}
