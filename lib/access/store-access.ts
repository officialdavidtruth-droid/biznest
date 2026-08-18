import { prisma } from "@/lib/prisma";

export type StoreAccessRole = "OWNER" | "MANAGER" | "STAFF" | "PLATFORM_STAFF" | null;

/**
 * Resolves what access (if any) a user has to a store's dashboard.
 *
 * This exists so "can this user touch this store" has exactly one
 * implementation. Before staff accounts existed, that check was just
 * `store.business.userId === session.user.id`, inlined in every action and
 * page that needed it. Adding a second kind of legitimate access (staff)
 * without a shared helper would mean finding and updating every one of
 * those call sites correctly and consistently — a single missed check is a
 * silent access-control bug. New code should call this instead of
 * re-deriving ownership; existing call sites can be migrated incrementally
 * without anything breaking in the meantime, since owner-only checks
 * remain correct (just incomplete) until they adopt this.
 *
 * PLATFORM_ADMIN / SUPPORT_MODERATOR are handled by the same function so
 * callers don't need a separate branch for platform staff impersonation.
 */
export async function getStoreAccessRole(
  userId: string,
  userPlatformRole: string,
  store: { id: string; business: { userId: string } }
): Promise<StoreAccessRole> {
  if (["PLATFORM_ADMIN", "SUPPORT_MODERATOR"].includes(userPlatformRole)) return "PLATFORM_STAFF";
  if (store.business.userId === userId) return "OWNER";

  const membership = await prisma.storeStaff.findFirst({
    where: { storeId: store.id, userId, status: "ACTIVE" },
  });
  if (membership?.role === "MANAGER") return "MANAGER";
  if (membership?.role === "STAFF") return "STAFF";
  return null;
}

/** Billing, subscription changes, and staff management are owner-only — never MANAGER or STAFF. */
export function canManageBillingAndStaff(role: StoreAccessRole): boolean {
  return role === "OWNER" || role === "PLATFORM_STAFF";
}

/** MANAGER and STAFF can run the day-to-day dashboard; only OWNER/PLATFORM_STAFF get the owner-only surfaces above. */
export function canAccessDashboard(role: StoreAccessRole): boolean {
  return role !== null;
}

/**
 * Whether a MANAGER/STAFF account was granted a specific area (see
 * lib/access/staff-permissions.ts) at invite time. OWNER and
 * PLATFORM_STAFF always pass — the permission checklist only restricts
 * invited staff, never the store's own owner or platform support.
 */
export function hasStorePermission(
  role: StoreAccessRole,
  permissions: string[] | null | undefined,
  permissionId: string
): boolean {
  if (role === "OWNER" || role === "PLATFORM_STAFF") return true;
  return (permissions ?? []).includes(permissionId);
}
