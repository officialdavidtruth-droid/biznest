"use server";

import { prisma } from "@/lib/prisma";
import { auth } from "@/lib/auth";
import { getStoreAccessRole, canManageBillingAndStaff } from "@/lib/access/store-access";
import type { ActionResult } from "@/types/actions";

export type StoreActivityEntry = {
  id: string;
  actorName: string;
  actorEmail: string;
  actorRole: string;
  action: string;
  target: string | null;
  metadata: unknown;
  createdAt: Date;
};

/**
 * Owner/platform-staff only — the same people who can manage staff can see
 * what staff have been doing. MANAGER/STAFF never see this, regardless of
 * their permission grants; it's not one of the invite-time checkboxes.
 */
export async function listStoreActivity(slug: string, limit = 100): Promise<ActionResult<StoreActivityEntry[]>> {
  const session = await auth();
  if (!session?.user?.id) return { success: false, error: "You must be signed in." };

  const store = await prisma.store.findUnique({ where: { slug }, include: { business: true } });
  if (!store) return { success: false, error: "Store not found." };

  const role = await getStoreAccessRole(session.user.id, session.user.role, store);
  if (!canManageBillingAndStaff(role)) {
    return { success: false, error: "Only the store owner can view the activity log." };
  }

  const entries = await prisma.storeActivityLog.findMany({
    where: { storeId: store.id },
    orderBy: { createdAt: "desc" },
    take: limit,
  });

  return { success: true, data: entries };
}
