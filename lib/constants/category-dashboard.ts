/**
 * Category-driven dashboard configuration.
 *
 * This file is now a thin adapter over lib/capabilities.ts — the actual
 * per-business-type data (icon, tagline, quick actions, extra nav items)
 * lives there as part of the Business Type → Capabilities → Sections →
 * Features system. Kept as a separate module only so existing call sites
 * (components/dashboard/sidebar.tsx, app/store/[slug]/admin/page.tsx)
 * don't need to change their import or the shape they consume.
 */

import type { LucideIcon } from "lucide-react";
import { getBusinessTypeConfig, DEFAULT_BUSINESS_TYPE, type QuickAction, type BusinessTypeConfig } from "@/lib/capabilities";

export type CategoryQuickAction = QuickAction;

export type CategoryDashboardConfig = {
  icon: LucideIcon;
  tagline: string;
  quickActions: CategoryQuickAction[];
  /** First extra nav item this category's capabilities imply, if any —
   * sidebar.tsx only ever showed one, so this stays singular for
   * backward compatibility even though a business type can define more
   * than one in lib/capabilities.ts. */
  extraNavItem?: { label: string; href: string; icon: LucideIcon };
};

function toDashboardConfig(config: BusinessTypeConfig): CategoryDashboardConfig {
  return {
    icon: config.icon,
    tagline: config.tagline,
    quickActions: config.quickActions,
    extraNavItem: config.extraNavItems?.[0],
  };
}

export const DEFAULT_CATEGORY_DASHBOARD: CategoryDashboardConfig = toDashboardConfig(DEFAULT_BUSINESS_TYPE);

export function getCategoryDashboard(category: string | null | undefined): CategoryDashboardConfig {
  return toDashboardConfig(getBusinessTypeConfig(category));
}
