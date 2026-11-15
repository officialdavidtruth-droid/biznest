import { assertStorePermission } from "@/lib/access/assert-store-access";
import { getPluginEntitlement } from "@/lib/plugins";

/** Same gate as the rest of Financial Control: signed in, permitted, and the app is installed. */
export async function financialAccess(slug: string) {
  const a = await assertStorePermission(slug, "plugin:financial-control");
  if (!a.success) return a;
  const entitlement = await getPluginEntitlement(a.store.id, "financial-control");
  if (!entitlement.allowed) return { success: false as const, error: entitlement.reason };
  if (!entitlement.installed) return { success: false as const, error: "Install Financial Control from Apps before opening this workspace." };
  return a;
}
