"use server";

import { cookies } from "next/headers";
import { revalidatePath } from "next/cache";
import type { PayoutStatus } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { ADMIN_COOKIE_NAME, verifyAdminToken } from "@/lib/admin-pin-auth";
import { markPayoutPaidManually, retryPayout } from "@/lib/payments/payout";
import type { ActionResult } from "@/types/actions";

// Same ADMIN_PIN cookie gate as lib/actions/admin.ts.
async function assertPlatformStaff() {
  const cookieStore = await cookies();
  const valid = await verifyAdminToken(cookieStore.get(ADMIN_COOKIE_NAME)?.value);
  return valid ? { success: true as const } : { success: false as const, error: "Admin PIN session expired or invalid. Please sign in again." };
}

export type PayoutTab = "NEEDS_ATTENTION" | "QUEUED" | "PROCESSING" | "PAID" | "ALL";

const TAB_FILTER: Record<PayoutTab, PayoutStatus[] | undefined> = {
  NEEDS_ATTENTION: ["FAILED", "REVERSED"],
  QUEUED: ["QUEUED"],
  PROCESSING: ["PROCESSING"],
  PAID: ["PAID"],
  ALL: undefined,
};

export async function listPayouts(tab: PayoutTab = "NEEDS_ATTENTION") {
  const access = await assertPlatformStaff();
  if (!access.success) return null;
  const statuses = TAB_FILTER[tab];
  return prisma.payout.findMany({
    where: statuses ? { status: { in: statuses } } : undefined,
    include: { store: { select: { name: true, slug: true } }, payment: { select: { reference: true, purpose: true } } },
    orderBy: { updatedAt: "desc" },
    take: 200,
  });
}

export async function getPayoutCounts() {
  const access = await assertPlatformStaff();
  if (!access.success) return null;
  const rows = await prisma.payout.groupBy({ by: ["status"], _count: { _all: true } });
  const count = (s: PayoutStatus) => rows.find((r) => r.status === s)?._count._all ?? 0;
  return { needsAttention: count("FAILED") + count("REVERSED"), queued: count("QUEUED"), processing: count("PROCESSING"), paid: count("PAID") };
}

export async function retryFailedPayout(payoutId: string): Promise<ActionResult> {
  const access = await assertPlatformStaff();
  if (!access.success) return { success: false, error: access.error };

  const result = await retryPayout(payoutId);
  await prisma.auditLog.create({
    data: { userId: null, action: "PAYOUT_RETRIED", entity: "Payout", entityId: payoutId, metadata: { ok: result.ok, message: result.message } },
  });
  revalidatePath("/supaadmin/payouts");
  return result.ok ? { success: true, data: undefined } : { success: false, error: result.message };
}

export async function markPayoutPaid(payoutId: string, note: string): Promise<ActionResult> {
  const access = await assertPlatformStaff();
  if (!access.success) return { success: false, error: access.error };

  const result = await markPayoutPaidManually(payoutId, note);
  if (result.ok) {
    await prisma.auditLog.create({
      data: { userId: null, action: "PAYOUT_MARKED_PAID_MANUALLY", entity: "Payout", entityId: payoutId, metadata: { note: note.trim() } },
    });
  }
  revalidatePath("/supaadmin/payouts");
  return result.ok ? { success: true, data: undefined } : { success: false, error: result.message };
}
