import {
  LayoutDashboard, ShoppingCart, Package, Wrench, Users, Boxes, Ticket,
  CreditCard, BarChart3, Star, Megaphone, MessageSquare,
  Settings, BadgeCheck, Wallet, LifeBuoy, Truck, Wand2, MousePointerClick,
  LayoutTemplate, FileText, FileSignature, MailWarning,
} from "lucide-react";
import { getCategoryDashboard } from "@/lib/constants/category-dashboard";

export type NavItem = { label: string; href: string; icon: typeof LayoutDashboard; ownerOnly?: boolean };

// Items in the "Sell" group that only make sense for one niche. Anything
// not listed here (Orders) is shared by every business, since orders and
// bookings both flow through the same order record.
const PRODUCT_ONLY_HREFS = new Set(["/products", "/inventory", "/delivery", "/suppliers", "/purchase-orders"]);
const SERVICE_ONLY_HREFS = new Set(["/services"]);

// Single source of truth for dashboard navigation, shared by the desktop
// sidebar and the mobile drawer/bottom-bar so the two surfaces never drift
// out of sync with each other.
export function buildNavGroups(business: { sellsProducts: boolean; offersServices: boolean; category?: string | null }): Array<{
  label: string;
  items: NavItem[];
}> {
  const sellItems: NavItem[] = [
    { label: "Orders", href: "/orders", icon: ShoppingCart },
    { label: "Products", href: "/products", icon: Package },
    { label: "Services", href: "/services", icon: Wrench },
    { label: "Inventory", href: "/inventory", icon: Boxes },
    { label: "Suppliers", href: "/suppliers", icon: Users },
    { label: "Purchase orders", href: "/purchase-orders", icon: FileSignature },
    { label: "Delivery zones", href: "/delivery", icon: Truck },
    { label: "Invoices", href: "/invoices", icon: FileText },
    { label: "Quotes", href: "/quotes", icon: FileSignature },
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
        { label: "Abandoned checkouts", href: "/abandoned-checkouts", icon: MailWarning },
        { label: "Reviews", href: "/reviews", icon: Star },
        { label: "Analytics", href: "/analytics", icon: BarChart3 },
      ],
    },
    {
      label: "Store",
      items: [
        { label: "Templates", href: "/templates", icon: LayoutTemplate },
        { label: "AI Store Builder", href: "/ai-store-builder", icon: Wand2 },
        { label: "Customize Website", href: "/customize", icon: Wand2 },
        { label: "Website Editor (beta)", href: "/website-editor", icon: MousePointerClick },
        { label: "Messages", href: "/messages", icon: MessageSquare },
        { label: "Payments", href: "/payments", icon: CreditCard },
        { label: "Settings", href: "/settings", icon: Settings },
      ],
    },
    {
      label: "Account",
      items: [
        { label: "Verification", href: "/verification", icon: BadgeCheck },
        { label: "Subscription", href: "/subscription", icon: Wallet, ownerOnly: true },
        { label: "Staff", href: "/staff", icon: Users, ownerOnly: true },
        { label: "Support", href: "/support", icon: LifeBuoy },
      ],
    },
  ];
}

/**
 * Filters ownerOnly items (billing, staff management) out of a nav group
 * list for anyone who isn't OWNER/PLATFORM_STAFF — used by both the
 * desktop sidebar and mobile chrome so a MANAGER/STAFF account never even
 * sees a link to a page it can't use. This is a UI convenience only; the
 * actual enforcement lives in each page/action (see lib/access/store-access.ts)
 * since a hidden nav link is not an access control mechanism.
 */
export function filterNavGroupsForRole<T extends { items: NavItem[] }>(
  groups: T[],
  canManageOwnerOnly: boolean
): T[] {
  if (canManageOwnerOnly) return groups;
  return groups
    .map((g) => ({ ...g, items: g.items.filter((i) => !i.ownerOnly) }))
    .filter((g) => g.items.length > 0) as T[];
}

// The 4 highest-frequency destinations, for the mobile bottom tab bar — a
// merchant checking their phone between customers needs these one thumb-tap
// away, not two taps deep in a drawer. The 5th slot is always "Menu" (opens
// the full drawer with everything else), not a nav item itself.
export function buildBottomTabItems(business: { sellsProducts: boolean; offersServices: boolean; category?: string | null }): NavItem[] {
  const groups = buildNavGroups(business);
  const dashboard = groups[0].items[0];
  const orders = groups[1].items.find((i) => i.href === "/orders")!;
  const catalog = groups[1].items.find((i) => i.href === "/products" || i.href === "/services") ?? groups[1].items[1];
  const abandoned = groups[2].items.find((i) => i.href === "/abandoned-checkouts")!;
  return [dashboard, orders, catalog, abandoned];
}
