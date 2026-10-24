import { prisma } from "@/lib/prisma";
import { getPluginEntitlement } from "@/lib/plugins";
import { assertStorePermission } from "@/lib/access/assert-store-access";

export type ProcurementGate =
  | { ok: true }
  | { ok: false; reason: "denied" | "not-installed"; message: string };

/**
 * Suppliers and purchase orders belong to the "Procurement & Vendors" app, not
 * the core dashboard. Access needs the app installed and, for staff, the app's
 * permission. Restaurants running the FnB app keep working too, because FnB
 * has its own Procurement/Suppliers tabs that link to these same pages.
 */
export async function getProcurementGate(slug: string): Promise<ProcurementGate> {
  const store = await prisma.store.findUnique({ where: { slug }, select: { id: true } });
  if (!store) return { ok: false, reason: "denied", message: "Store not found." };

  const procurement = await getPluginEntitlement(store.id, "procurement");
  if (procurement.allowed && procurement.installed) {
    const access = await assertStorePermission(slug, "plugin:procurement");
    return access.success ? { ok: true } : { ok: false, reason: "denied", message: access.error };
  }

  const fnb = await getPluginEntitlement(store.id, "fnb-operations");
  if (fnb.allowed && fnb.installed) {
    const access = await assertStorePermission(slug, "plugin:fnb-operations");
    return access.success ? { ok: true } : { ok: false, reason: "denied", message: access.error };
  }

  return {
    ok: false,
    reason: "not-installed",
    message: procurement.allowed
      ? "Suppliers and purchase orders are part of the Procurement & Vendors app. Install it from Apps to use them."
      : procurement.reason ?? "Procurement & Vendors isn't available on your plan.",
  };
}
