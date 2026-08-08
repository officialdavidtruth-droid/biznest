"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  LayoutDashboard, ShoppingCart, Package, Wrench, Users, Boxes, Ticket,
  CreditCard, BarChart3, Star, Megaphone, MessageSquare, LayoutTemplate,
  Settings, BadgeCheck, Wallet, LifeBuoy, Truck, Rows3, Wand2, MousePointerClick,
} from "lucide-react";
import { getCategoryDashboard } from "@/lib/constants/category-dashboard";

type NavItem = { label: string; href: string; icon: typeof LayoutDashboard };

// Items in the "Sell" group that only make sense for one niche. Anything
// not listed here (Orders) is shared by every business, since orders and
// bookings both flow through the same order record.
const PRODUCT_ONLY_HREFS = new Set(["/products", "/inventory", "/delivery"]);
const SERVICE_ONLY_HREFS = new Set(["/services"]);

function buildNavGroups(business: { sellsProducts: boolean; offersServices: boolean; category?: string | null }): Array<{
  label: string;
  items: NavItem[];
}> {
  const sellItems: NavItem[] = [
    { label: "Orders", href: "/orders", icon: ShoppingCart },
    { label: "Products", href: "/products", icon: Package },
    { label: "Services", href: "/services", icon: Wrench },
    { label: "Inventory", href: "/inventory", icon: Boxes },
    { label: "Delivery zones", href: "/delivery", icon: Truck },
  ].filter((item) => {
    if (PRODUCT_ONLY_HREFS.has(item.href)) return business.sellsProducts;
    if (SERVICE_ONLY_HREFS.has(item.href)) return business.offersServices;
    return true;
  });

  // The category picked at onboarding can add one more trade-specific tool
  // (e.g. "Bookings" for a salon, "Delivery zones" for a restaurant) — but
  // only if it isn't already present from sellsProducts/offersServices above.
  const categoryConfig = getCategoryDashboard(business.category);
  if (categoryConfig.extraNavItem && !sellItems.some((i) => i.href === categoryConfig.extraNavItem!.href)) {
    sellItems.push(categoryConfig.extraNavItem);
  }

  return [
    {
      label: "Overview",
      items: [{ label: "Dashboard", href: "", icon: LayoutDashboard }],
    },
    {
      label: "Sell",
      items: sellItems,
    },
    {
      label: "Grow",
      items: [
        { label: "Customers", href: "/customers", icon: Users },
        { label: "Coupons", href: "/coupons", icon: Ticket },
        { label: "Marketing", href: "/marketing", icon: Megaphone },
        { label: "Reviews", href: "/reviews", icon: Star },
        { label: "Analytics", href: "/analytics", icon: BarChart3 },
      ],
    },
    {
      label: "Store",
      items: [
        { label: "Customize Website", href: "/customize", icon: Wand2 },
        { label: "Website Builder", href: "/builder", icon: LayoutTemplate },
        { label: "Website Editor (beta)", href: "/website-editor", icon: MousePointerClick },
        { label: "Storefront Layout", href: "/layout-editor", icon: Rows3 },
        { label: "Messages", href: "/messages", icon: MessageSquare },
        { label: "Payments", href: "/payments", icon: CreditCard },
        { label: "Settings", href: "/settings", icon: Settings },
      ],
    },
    {
      label: "Account",
      items: [
        { label: "Verification", href: "/verification", icon: BadgeCheck },
        { label: "Subscription", href: "/subscription", icon: Wallet },
        { label: "Support", href: "/support", icon: LifeBuoy },
      ],
    },
  ];
}

export function DashboardSidebar({
  slug,
  storeName,
  sellsProducts,
  offersServices,
  category,
}: {
  slug: string;
  storeName: string;
  // What this business does — controls which "Sell" items appear. Both
  // default true/false-safe (a hybrid store just passes both true).
  sellsProducts: boolean;
  offersServices: boolean;
  // The category chosen at onboarding — adds one trade-specific nav item.
  category?: string | null;
}) {
  const pathname = usePathname();
  const base = `/store/${slug}/admin`;
  const NAV_GROUPS = buildNavGroups({ sellsProducts, offersServices, category });

  return (
    <aside className="flex h-full w-64 shrink-0 flex-col border-r border-border bg-background">
      <div className="border-b border-border px-4 py-4">
        <div className="flex items-center gap-2.5">
          <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-primary text-sm font-bold text-primary-foreground">
            {storeName.charAt(0).toUpperCase()}
          </div>
          <div className="min-w-0">
            <p className="truncate text-sm font-semibold leading-tight">{storeName}</p>
            <p className="truncate text-xs text-muted-foreground">/store/{slug}</p>
          </div>
        </div>
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

      <div className="border-t border-border px-4 py-3">
        <Link href={`/store/${slug}`} className="text-xs font-medium text-muted-foreground hover:text-primary">
          View live store →
        </Link>
      </div>
    </aside>
  );
}
