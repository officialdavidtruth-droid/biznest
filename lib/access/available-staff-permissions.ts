import { prisma } from "@/lib/prisma";
import { getCanonicalBusinessType } from "@/lib/business-identity";
import { buildNavGroups } from "@/lib/constants/dashboard-nav";
import { STAFF_PERMISSIONS } from "@/lib/access/staff-permissions";

/**
 * Core permissions that only mean something once a specific app is
 * installed. Everything else is decided by what the store's own dashboard
 * actually shows (see buildNavGroups), so the invite checklist can never
 * offer an area the owner can't see themselves.
 */
const PLUGIN_GATED: Record<string, string> = {
  finance: "financial-control",
  hr: "hr-payroll",
  "fnb:pos": "fnb-operations",
  "fnb:orders": "fnb-operations",
  "fnb:kitchen": "fnb-operations",
  "fnb:menu": "fnb-operations",
  "fnb:inventory": "fnb-operations",
  "fnb:recipes": "fnb-operations",
  "fnb:procurement": "fnb-operations",
  "fnb:suppliers": "fnb-operations",
  "fnb:customers": "fnb-operations",
  "fnb:reports": "fnb-operations",
  "fnb:settings": "fnb-operations",
};

export type AvailableStaffPermission = { id: string; label: string };

/**
 * The invite/edit checklist for one store: a core permission is offered only
 * if (a) a dashboard page in this store's sidebar is gated by it, or (b) it
 * belongs to an app (Financial Control, HR & Payroll, FnB) that is installed.
 */
export async function getAvailableStaffPermissions(storeId: string): Promise<AvailableStaffPermission[]> {
  const store = await prisma.store.findUnique({
    where: { id: storeId },
    select: {
      businessType: true,
      business: { select: { sellsProducts: true, offersServices: true, category: true } },
      subscription: { select: { name: true } },
      installedPlugins: {
        where: { status: "ACTIVE", plugin: { status: "ACTIVE" } },
        select: { plugin: { select: { key: true, name: true } } },
      },
    },
  });
  if (!store) return [];

  const installedApps = store.installedPlugins.map((x) => ({ key: x.plugin.key, name: x.plugin.name }));
  const installedKeys = new Set(installedApps.map((a) => a.key));

  const groups = buildNavGroups({
    sellsProducts: store.business.sellsProducts,
    offersServices: store.business.offersServices,
    category: getCanonicalBusinessType({ businessCategory: store.business.category, storeBusinessType: store.businessType }),
    subscriptionName: store.subscription?.name,
    installedApps,
  });

  const inNav = new Set<string>();
  for (const group of groups) {
    for (const item of group.items) {
      if (item.permission) inNav.add(item.permission);
      for (const child of item.children ?? []) if (child.permission) inNav.add(child.permission);
    }
  }

  return STAFF_PERMISSIONS.filter((p) => {
    const requiredApp = PLUGIN_GATED[p.id];
    return requiredApp ? installedKeys.has(requiredApp) : inNav.has(p.id);
  }).map((p) => ({ id: p.id, label: p.label }));
}
