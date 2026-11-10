"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { assertStorePermission } from "@/lib/access/assert-store-access";
import { CHURN_COPY } from "@/lib/churn/copy";
import type { ChurnKind } from "@/lib/churn/signals";
import type { ActionResult } from "@/types/actions";

/** The single most important open tip for this store (owner dashboard card). */
const PRIORITY: ChurnKind[] = ["PAYMENT_FAILED", "NO_ORDERS", "UNUSED_PLUGIN", "NO_LOGIN"];

export type ChurnTip = { id: string; kind: ChurnKind; title: string; body: string; href: string; cta: string; notifiedAt: string | null };

/** Owner-only; returns null for anyone else or when nothing is open. Never throws. */
export async function getOpenChurnTip(storeId: string, slug: string): Promise<ChurnTip | null> {
  try {
    const rows = await prisma.churnSignal.findMany({
      where: { storeId, resolvedAt: null, dismissedAt: null },
      select: { id: true, kind: true, notifiedAt: true },
    });
    const row = PRIORITY.map((k) => rows.find((r) => r.kind === k)).find(Boolean);
    if (!row) return null;
    const c = CHURN_COPY[row.kind as ChurnKind];
    return { id: row.id, kind: row.kind as ChurnKind, title: c.title, body: c.body, href: c.href(slug), cta: c.cta, notifiedAt: row.notifiedAt ? row.notifiedAt.toISOString() : null };
  } catch {
    return null;
  }
}

export async function dismissChurnTip(slug: string, signalId: string): Promise<ActionResult> {
  const access = await assertStorePermission(slug, "settings");
  if (!access.success) return { success: false, error: access.error };
  if (access.role !== "OWNER" && access.role !== "PLATFORM_STAFF") return { success: false, error: "Only the store owner can do this." };
  // Scoped to this store so a signal id from another store can't be dismissed.
  await prisma.churnSignal.updateMany({ where: { id: signalId, storeId: access.store.id }, data: { dismissedAt: new Date() } });
  revalidatePath(`/store/${slug}/admin`);
  return { success: true, data: undefined };
}
