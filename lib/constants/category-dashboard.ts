/**
 * Category-driven dashboard configuration.
 *
 * The category a business picks at onboarding (see the "Select a category"
 * field on Create Store / Business Verification) doesn't just label the
 * listing — it decides what the Overview dashboard highlights and which
 * extra tool, if any, shows up in the sidebar. Every category below gets
 * its own view: different quick-stat labels, different quick actions, and
 * (for a few) a category-only nav item.
 */

import type { LucideIcon } from "lucide-react";
import {
  Shirt, Cpu, Utensils, Sparkles, Sofa, HeartPulse,
  Briefcase, Car, Tractor, Store as StoreIcon, Truck, CalendarClock, Wrench,
} from "lucide-react";

export type CategoryQuickAction = { label: string; href: string };

export type CategoryDashboardConfig = {
  icon: LucideIcon;
  /** Short label shown as the dashboard's category badge. */
  tagline: string;
  /** Quick-action shortcuts shown on the Overview page, specific to this trade. */
  quickActions: CategoryQuickAction[];
  /** Optional extra sidebar nav item only this category gets. */
  extraNavItem?: { label: string; href: string; icon: LucideIcon };
};

export const CATEGORY_DASHBOARD: Record<string, CategoryDashboardConfig> = {
  "Fashion": {
    icon: Shirt,
    tagline: "Fashion storefront",
    quickActions: [
      { label: "Add a product", href: "/products/new" },
      { label: "Set up size & color variants", href: "/products" },
      { label: "Run a seasonal coupon", href: "/coupons" },
    ],
  },
  "Electronics": {
    icon: Cpu,
    tagline: "Electronics storefront",
    quickActions: [
      { label: "Add a product", href: "/products/new" },
      { label: "Track stock levels", href: "/inventory" },
      { label: "Set warranty terms", href: "/settings" },
    ],
  },
  "Food & Groceries": {
    icon: Utensils,
    tagline: "Food & groceries storefront",
    quickActions: [
      { label: "Add a menu item", href: "/products/new" },
      { label: "Set delivery zones", href: "/delivery" },
      { label: "Check today's orders", href: "/orders" },
    ],
    extraNavItem: { label: "Delivery zones", href: "/delivery", icon: Truck },
  },
  "Beauty": {
    icon: Sparkles,
    tagline: "Beauty storefront",
    quickActions: [
      { label: "Add a service", href: "/services/new" },
      { label: "Manage bookings", href: "/orders" },
      { label: "Collect reviews", href: "/reviews" },
    ],
    extraNavItem: { label: "Bookings", href: "/orders", icon: CalendarClock },
  },
  "Home & Furniture": {
    icon: Sofa,
    tagline: "Home & furniture storefront",
    quickActions: [
      { label: "Add a product", href: "/products/new" },
      { label: "Set delivery zones", href: "/delivery" },
      { label: "Track stock levels", href: "/inventory" },
    ],
  },
  "Health": {
    icon: HeartPulse,
    tagline: "Health storefront",
    quickActions: [
      { label: "Add a service", href: "/services/new" },
      { label: "Manage bookings", href: "/orders" },
      { label: "Update your credentials", href: "/verification" },
    ],
    extraNavItem: { label: "Bookings", href: "/orders", icon: CalendarClock },
  },
  "Professional Services": {
    icon: Briefcase,
    tagline: "Professional services storefront",
    quickActions: [
      { label: "Add a service", href: "/services/new" },
      { label: "Manage bookings", href: "/orders" },
      { label: "Message a customer", href: "/messages" },
    ],
    extraNavItem: { label: "Bookings", href: "/orders", icon: CalendarClock },
  },
  "Automotive": {
    icon: Car,
    tagline: "Automotive storefront",
    quickActions: [
      { label: "Add a product or service", href: "/products/new" },
      { label: "Manage bookings", href: "/orders" },
      { label: "Track parts inventory", href: "/inventory" },
    ],
    extraNavItem: { label: "Bookings", href: "/orders", icon: Wrench },
  },
  "Agriculture": {
    icon: Tractor,
    tagline: "Agriculture storefront",
    quickActions: [
      { label: "Add produce", href: "/products/new" },
      { label: "Set delivery zones", href: "/delivery" },
      { label: "Track stock levels", href: "/inventory" },
    ],
  },
  "Other": {
    icon: StoreIcon,
    tagline: "Storefront",
    quickActions: [
      { label: "Add a listing", href: "/products/new" },
      { label: "Check today's orders", href: "/orders" },
      { label: "Customize your website", href: "/customize" },
    ],
  },
};

export const DEFAULT_CATEGORY_DASHBOARD: CategoryDashboardConfig = CATEGORY_DASHBOARD["Other"];

export function getCategoryDashboard(category: string | null | undefined): CategoryDashboardConfig {
  if (!category) return DEFAULT_CATEGORY_DASHBOARD;
  return CATEGORY_DASHBOARD[category] ?? DEFAULT_CATEGORY_DASHBOARD;
}
