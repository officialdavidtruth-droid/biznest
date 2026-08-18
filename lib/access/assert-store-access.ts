import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { getStoreAccessRole, hasStorePermission, type StoreAccessRole } from "@/lib/access/store-access";
import type { StaffPermissionId } from "@/lib/access/staff-permissions";
import type { Store, Business } from "@prisma/client";

export type StoreAccessResult =
  | { success: true; store: Store & { business: Business }; role: StoreAccessRole }
  | { success: false; error: string };

/**
 * Replaces the "isOwner || PLATFORM_ADMIN/SUPPORT_MODERATOR, else reject"
 * check that used to be copy-pasted (as a local `assertStoreAccess`) into
 * product.ts, order.ts, coupon.ts, inventory.ts, service.ts, and others.
 * That version had no path for MANAGER/STAFF at all — an invited staff
 * member's granted permission checkboxes had no effect because every
 * mutation rejected them before checking permissions. This is the shared
 * replacement: OWNER/PLATFORM_STAFF always pass; MANAGER/STAFF pass only
 * if they were granted `permissionId` (see lib/access/staff-permissions.ts).
 *
 * Other action files with the same old pattern should migrate to this one
 * the same way product.ts/order.ts/coupon.ts/inventory.ts/service.ts did —
 * search for `isStaff = session.user.role === "PLATFORM_ADMIN"` to find them.
 */
export async function assertStorePermission(
  slug: string,
  permissionId: StaffPermissionId
): Promise<StoreAccessResult> {
  const session = await auth();
  if (!session?.user?.id) return { success: false, error: "You must be signed in." };

  const store = await prisma.store.findUnique({ where: { slug }, include: { business: true } });
  if (!store) return { success: false, error: "Store not found." };

  const role = await getStoreAccessRole(session.user.id, session.user.role, store);
  if (role === null) return { success: false, error: "You don't have access to this store." };

  if (role === "MANAGER" || role === "STAFF") {
    const membership = await prisma.storeStaff.findFirst({
      where: { storeId: store.id, userId: session.user.id, status: "ACTIVE" },
      select: { permissions: true },
    });
    if (!hasStorePermission(role, membership?.permissions, permissionId)) {
      return { success: false, error: "You don't have access to this area." };
    }
  }

  return { success: true, store, role };
}
