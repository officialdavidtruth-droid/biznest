import {
  LayoutDashboard, ShoppingCart, Package, Wrench, Users, Boxes, Ticket,
  CreditCard, BarChart3, Star, Megaphone, MessageSquare,
  Settings, BadgeCheck, Wallet, LifeBuoy, Truck, Wand2,
  LayoutTemplate, FileText, FileSignature, MailWarning, Calculator,
} from "lucide-react";
import { getCategoryDashboard } from "@/lib/constants/category-dashboard";
import type { StaffPermissionId } from "@/lib/access/staff-permissions";

export type NavItem = {
  label: string;
  href: string;
  icon: typeof LayoutDashboard;
  ownerOnly?: boolean;
  // Which invite-time checkbox (see lib/access/staff-permissions.ts) gates
  // this page for MANAGER/STAFF accounts. Undefined = no specific
  // permission needed, just active staff/owner status (e.g. Dashboard,
  // Support). OWNER/PLATFORM_STAFF always bypass this.
  permission?: StaffPermissionId;
};

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
  const allSellItems: NavItem[] = [
    { label: "Point of Sale", href: "/pos", icon: Calculator, permission: "pos" },
    { label: "Orders", href: "/orders", icon: ShoppingCart, permission: "orders" },
    { label: "Products", href: "/products", icon: Package, permission: "products" },
    { label: "Services", href: "/services", icon: Wrench, permission: "products" },
    { label: "Inventory", href: "/inventory", icon: Boxes, permission: "products" },
    { label: "Suppliers", href: "/suppliers", icon: Users, permission: "products" },
    { label: "Purchase orders", href: "/purchase-orders", icon: FileSignature, permission: "products" },
    { label: "Delivery zones", href: "/delivery", icon: Truck, permission: "settings" },
    { label: "Invoices", href: "/invoices", icon: FileText, permission: "orders" },
    { label: "Quotes", href: "/quotes", icon: FileSignature, permission: "orders" },
  ];
  // Split into its own statement (rather than chaining .filter() straight
  // off the literal) so the `: NavItem[]` annotation above actually
  // contextually types each object literal's `permission` field as the
  // StaffPermissionId union — chaining .filter() directly off the array
  // literal stops that contextual typing from applying, which widened
  // `permission` to plain `string` and failed to satisfy NavItem[].
  const sellItems: NavItem[] = allSellItems.filter((item) => {
    if (PRODUCT_ONLY_HREFS.has(item.href)) return business.sellsProducts;
    if (SERVICE_ONLY_HREFS.has(item.href)) return business.offersServices;
    return true;
  });

  // The category picked at onboarding can add one more trade-specific tool
  // (e.g. "Bookings" for a salon, "Delivery zones" for a restaurant) — but
  // only if it isn't already present from sellsProducts/offersServices above.
  const categoryConfig = getCategoryDashboard(business.category);
  const categoryExtraNavItem =
    categoryConfig.extraNavItem && !sellItems.some((i) => i.href === categoryConfig.extraNavItem!.href)
      ? ({ permission: "products", ...categoryConfig.extraNavItem } as NavItem)
      : null;

  const sellNavItems = sellItems.filter((item) =>
    ["/products", "/services", "/orders", "/pos"].includes(item.href)
  );
  if (categoryExtraNavItem) sellNavItems.push(categoryExtraNavItem);

  return [
    {
      label: "Overview",
      items: [{ label: "Dashboard", href: "", icon: LayoutDashboard }],
    },
    {
      label: "Sell",
      items: sellNavItems,
    },
    {
      label: "Manage",
      items: [
        { label: "Inventory", href: "/inventory", icon: Boxes, permission: "products" },
        { label: "Customers", href: "/customers", icon: Users, permission: "customers" },
        { label: "Suppliers", href: "/suppliers", icon: Users, permission: "products" },
        { label: "Purchase orders", href: "/purchase-orders", icon: FileSignature, permission: "products" },
        { label: "Delivery zones", href: "/delivery", icon: Truck, permission: "settings" },
        { label: "Staff", href: "/staff", icon: Users, ownerOnly: true },
      ],
    },
    {
      label: "Money",
      items: [
        { label: "Payments", href: "/payments", icon: CreditCard, permission: "payments" },
        { label: "Invoices", href: "/invoices", icon: FileText, permission: "orders" },
        { label: "Quotes", href: "/quotes", icon: FileSignature, permission: "orders" },
        // Profit is surfaced inside Analytics until a dedicated profit/expense
        // ledger exists, so we don't create a dead navigation destination.
      ],
    },
    {
      label: "Grow",
      items: [
        { label: "Marketing", href: "/marketing", icon: Megaphone, permission: "marketing" },
        { label: "Coupons", href: "/coupons", icon: Ticket, permission: "marketing" },
        { label: "Abandoned checkouts", href: "/abandoned-checkouts", icon: MailWarning, permission: "marketing" },
        { label: "Reviews", href: "/reviews", icon: Star, permission: "marketing" },
        { label: "Messages", href: "/messages", icon: MessageSquare, permission: "messages" },
        { label: "Analytics & Profit", href: "/analytics", icon: BarChart3, permission: "analytics" },
      ],
    },
    {
      label: "Website",
      items: [
        { label: "Templates", href: "/templates", icon: LayoutTemplate, permission: "settings" },
        { label: "AI Store Builder", href: "/ai-store-builder", icon: Wand2, permission: "settings" },
        { label: "Website Builder", href: "/customize", icon: Wand2, permission: "settings" },
      ],
    },
    {
      label: "Account",
      items: [
        { label: "Settings", href: "/settings", icon: Settings, permission: "settings" },
        { label: "Verification", href: "/verification", icon: BadgeCheck, permission: "settings" },
        { label: "Subscription", href: "/subscription", icon: Wallet, ownerOnly: true },
        { label: "Activity log", href: "/activity", icon: FileText, ownerOnly: true },
        { label: "Support", href: "/support", icon: LifeBuoy },
      ],
    },
  ];
}

/**
 * Filters ownerOnly items (billing, staff management, activity log) out
 * for anyone who isn't OWNER/PLATFORM_STAFF, and — for MANAGER/STAFF —
 * additionally filters out items gated behind a permission (see NavItem
 * above) that this particular staff member wasn't granted. Used by both
 * the desktop sidebar and mobile chrome so a MANAGER/STAFF account never
 * even sees a link to a page it can't use. This is a UI convenience only;
 * the actual enforcement lives in the admin layout + each server action
 * (see lib/access/store-access.ts) since a hidden nav link is not an
 * access control mechanism.
 */
export function filterNavGroupsForRole<T extends { items: NavItem[] }>(
  groups: T[],
  opts: { canManageOwnerOnly: boolean; permissions?: string[] | null }
): T[] {
  if (opts.canManageOwnerOnly) return groups;
  const granted = new Set(opts.permissions ?? []);
  return groups
    .map((g) => ({
      ...g,
      items: g.items.filter((i) => !i.ownerOnly && (!i.permission || granted.has(i.permission))),
    }))
    .filter((g) => g.items.length > 0) as T[];
}

/**
 * The reverse lookup used by the admin layout to enforce access
 * server-side: given the sub-path a MANAGER/STAFF request is hitting
 * (e.g. "/settings"), find which permission (if any) it requires. Falls
 * back to matching on the longest href prefix so nested routes under a
 * gated section (e.g. "/products/123/edit") inherit that section's
 * permission requirement without needing their own NavItem entry.
 */
export function findNavItemForPath(business: {
  sellsProducts: boolean;
  offersServices: boolean;
  category?: string | null;
}, subpath: string): NavItem | undefined {
  const items = buildNavGroups(business).flatMap((g) => g.items);
  const normalized = subpath === "" ? "/" : subpath;
  const exact = items.find((i) => (i.href || "/") === normalized);
  if (exact) return exact;
  return items
    .filter((i) => i.href && normalized.startsWith(`${i.href}/`))
    .sort((a, b) => b.href.length - a.href.length)[0];
}

// The 4 highest-frequency destinations, for the mobile bottom tab bar — a
// merchant checking their phone between customers needs these one thumb-tap
// away, not two taps deep in a drawer. The 5th slot is always "Menu" (opens
// the full drawer with everything else), not a nav item itself.
export function buildBottomTabItems(
  business: { sellsProducts: boolean; offersServices: boolean; category?: string | null },
  opts?: { canManageOwnerOnly: boolean; permissions?: string[] | null }
): NavItem[] {
  const groups = buildNavGroups(business);
  const filtered = opts ? filterNavGroupsForRole(groups, opts) : groups;
  const items = filtered.flatMap((g) => g.items);
  // Dashboard is never permission-gated, so it's always present. The rest
  // are the next-highest-priority items still available to this account,
  // falling back down the list if a preferred one was filtered out.
  const preferred = [
    items.find((i) => i.href === ""),
    items.find((i) => i.href === "/pos"),
    items.find((i) => i.href === "/orders"),
    items.find((i) => i.href === "/products" || i.href === "/services"),
  ].filter((i): i is NavItem => Boolean(i));
  const rest = items.filter((i) => !preferred.includes(i));
  return preferred.concat(rest).slice(0, 4);
}
