"use server";

import { cookies } from "next/headers";
import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import type { ActionResult } from "@/types/actions";
import { ADMIN_COOKIE_NAME } from "@/lib/admin-pin-auth";
import { verifyAdminSession } from "@/lib/admin-session";
import { nudgeOwner } from "@/lib/churn/nudge";
import type { ChurnKind } from "@/lib/churn/signals";

const PRIORITY: ChurnKind[] = ["PAYMENT_FAILED", "NO_ORDERS", "UNUSED_PLUGIN", "NO_LOGIN"];

async function isAdmin() {
  const token = (await cookies()).get(ADMIN_COOKIE_NAME)?.value;
  return !!(await verifyAdminSession(token));
}

async function nudgeStore(storeId: string): Promise<boolean> {
  const store = await prisma.store.findUnique({
    where: { id: storeId },
    select: { id: true, slug: true, business: { select: { userId: true } }, churnSignals: { where: { resolvedAt: null }, select: { kind: true } } },
  });
  if (!store) return false;
  const kind = PRIORITY.map((k) => store.churnSignals.find((r) => r.kind === k)).find(Boolean)?.kind as ChurnKind | undefined;
  if (!kind) return false;
  await nudgeOwner({ userId: store.business.userId, storeId: store.id, slug: store.slug, kind });
  await prisma.auditLog.create({ data: { userId: null, action: "CHURN_NUDGE_SENT", entity: "Store", entityId: store.id, metadata: { kind, manual: true } } });
  return true;
}

/** Sends the owner a reminder now: phone notification, bell, and a pop-up card on their dashboard. */
export async function sendAtRiskNudge(storeId: string): Promise<ActionResult> {
  if (!(await isAdmin())) return { success: false, error: "Admin session expired. Sign in again." };
  const ok = await nudgeStore(storeId);
  if (!ok) return { success: false, error: "This store has no open warning signs to remind about." };
  revalidatePath("/supaadmin/at-risk");
  return { success: true, data: undefined };
}

/** Reminds every at-risk store at once. */
export async function sendAtRiskNudgeAll(): Promise<ActionResult<{ sent: number }>> {
  if (!(await isAdmin())) return { success: false, error: "Admin session expired. Sign in again." };
  const rows = await prisma.churnSignal.findMany({ where: { resolvedAt: null }, distinct: ["storeId"], select: { storeId: true }, take: 500 });
  let sent = 0;
  for (const r of rows) {
    try { if (await nudgeStore(r.storeId)) sent++; } catch { /* one failure shouldn't stop the rest */ }
  }
  revalidatePath("/supaadmin/at-risk");
  return { success: true, data: { sent } };
}
