import "server-only";
import { prisma } from "@/lib/prisma";
import { auth } from "@/lib/auth";
import { logError, errorMeta } from "@/lib/observability/log";
import type { Prisma } from "@prisma/client";

// Lives outside lib/actions/activity.ts on purpose: that file is "use server",
// and every export of a "use server" file is a public endpoint anyone can call.
// This function trusts its caller for storeId and actor, so it must only be
// imported by other server code, never exposed as an action.

/**
 * Records one entry in a store's activity log. Call this from any server
 * action that changes something a store owner would want visibility into
 * (staff invited/removed, product created/edited/deleted, order status
 * changed, coupon created, etc). Never throws — a logging failure should
 * never take down the action it's describing, so errors are swallowed --
 * but reported to System Health / Sentry (never silently dropped).
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
    await logError("DATABASE", "Store activity log write failed", errorMeta(err, { storeId: params.storeId, action: params.action, skipAlert: true }));
  }
}

/**
 * Same as logStoreActivity, but resolves the actor from the signed-in session
 * so call sites can't mis-attribute an action to the business owner.
 * `role` should be the actor's store role (access.role) when known.
 */
export async function logActivity(params: {
  storeId: string;
  action: string;
  role?: string | null;
  target?: string;
  metadata?: Record<string, unknown>;
}) {
  const session = await auth().catch(() => null);
  await logStoreActivity({
    storeId: params.storeId,
    actor: {
      id: session?.user?.id,
      name: session?.user?.name,
      email: session?.user?.email,
      role: params.role ?? session?.user?.role ?? "unknown",
    },
    action: params.action,
    target: params.target,
    metadata: params.metadata,
  });
}
