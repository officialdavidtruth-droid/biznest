"use server";

import { prisma } from "@/lib/prisma";
import { auth } from "@/lib/auth";
import { getStoreAccessRole, canManageBillingAndStaff } from "@/lib/access/store-access";
import type { ActionResult } from "@/types/actions";
import type { Prisma } from "@prisma/client";

/**
 * Records one entry in a store's activity log. Call this from any server
 * action that changes something a store owner would want visibility into
 * (staff invited/removed, product created/edited/deleted, order status
 * changed, coupon created, etc). Never throws — a logging failure should
 * never take down the action it's describing, so errors are swallowed
 * after a console.error.
 *
 * `actor` is whoever performed the action (from `auth()` in the calling
 * action) — not necessarily the store owner, since the whole point is
 * tracking what staff/managers did on the owner's behalf.
 */
export async function logStoreActivity(params: {
  storeId: string;
  actor: { id?: string | null; name?: string | null; email?: string | null; role: string };
  action: string;
  target?: string;
  metadata?: Record<string, unknown>;
}) {
  try {
    await prisma.storeActivityLog.create({
      data: {
        storeId: params.storeId,
        actorUserId: params.actor.id ?? null,
        actorName: params.actor.name ?? params.actor.email ?? "Unknown",
        actorEmail: params.actor.email ?? "unknown",
        actorRole: params.actor.role,
        action: params.action,
        target: params.target,
        // Prisma's Json input type doesn't accept a plain
        // Record<string, unknown> directly (it wants InputJsonValue,
        // whose object variant is structurally narrower) — this cast is
        // safe since we only ever pass plain JSON-serializable data here.
        metadata: params.metadata as Prisma.InputJsonValue | undefined,
      },
    });
  } catch (err) {
    console.error("logStoreActivity failed", err);
  }
}

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
