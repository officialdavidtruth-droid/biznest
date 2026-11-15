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

/**
 * Who is asking, and how much of Financial Control they may use:
 * "full" for the owner and staff granted the whole app, "audit" for staff granted
 * only the audit permission (they can count, record findings and sign off, nothing else).
 */
export async function financialAccessLevel(slug: string) {
  const full = await financialAccess(slug);
  if (full.success) return { success: true as const, level: "full" as const, a: full };
  const audit = await assertStorePermission(slug, "finance:audit");
  if (!audit.success) return { success: false as const, error: full.error };
  const entitlement = await getPluginEntitlement(audit.store.id, "financial-control");
  if (!entitlement.allowed) return { success: false as const, error: entitlement.reason };
  if (!entitlement.installed) return { success: false as const, error: "Install Financial Control from Apps before opening this workspace." };
  return { success: true as const, level: "audit" as const, a: audit };
}
