"use server";

import { cookies, headers } from "next/headers";
import { revalidatePath } from "next/cache";
import type { PayoutStatus } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { ADMIN_COOKIE_NAME, adminSessionIdFromToken } from "@/lib/admin-pin-auth";
import { verifyAdminSession } from "@/lib/admin-session";
import { getClientIp } from "@/lib/rate-limit";
import { closeOpenPayouts, markPayoutPaidManually, releaseHeldPayouts, retryPayout, retryQueuedPayoutsNow } from "@/lib/payments/payout";
import { getGatewayBalanceKobo } from "@/lib/payments/payout-gateway";
import { getActiveGateway, getPayoutMode, type PayoutMode } from "@/lib/actions/site-settings";
import type { ActionResult } from "@/types/actions";

// Same ADMIN_PIN cookie gate as lib/actions/admin.ts.
async function assertPlatformStaff() {
  const cookieStore = await cookies();
  const token = cookieStore.get(ADMIN_COOKIE_NAME)?.value;
  const valid = await verifyAdminSession(token);
  if (!valid) return { success: false as const, error: "Admin PIN session expired or invalid. Please sign in again." };
  // There is one shared PIN, so no person to record -- log which sign-in and
  // which IP did it so a payout action can still be traced.
  const actor = { adminSession: adminSessionIdFromToken(token), ip: getClientIp(await headers()) };
  return { success: true as const, actor };
}

export type PayoutTab = "NEEDS_ATTENTION" | "HELD" | "QUEUED" | "PROCESSING" | "PAID" | "ALL";

const TAB_FILTER: Record<PayoutTab, PayoutStatus[] | undefined> = {
  NEEDS_ATTENTION: ["FAILED", "REVERSED"],
  HELD: ["HELD"],
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
  return { needsAttention: count("FAILED") + count("REVERSED"), held: count("HELD"), queued: count("QUEUED"), processing: count("PROCESSING"), paid: count("PAID") };
}

export async function retryFailedPayout(payoutId: string): Promise<ActionResult> {
  const access = await assertPlatformStaff();
  if (!access.success) return { success: false, error: access.error };

  const result = await retryPayout(payoutId);
  await prisma.auditLog.create({
    data: { userId: null, action: "PAYOUT_RETRIED", entity: "Payout", entityId: payoutId, metadata: { ok: result.ok, message: result.message, ...access.actor } },
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
      data: { userId: null, action: "PAYOUT_MARKED_PAID_MANUALLY", entity: "Payout", entityId: payoutId, metadata: { note: note.trim(), ...access.actor } },
    });
  }
  revalidatePath("/supaadmin/payouts");
  return result.ok ? { success: true, data: undefined } : { success: false, error: result.message };
}

/** Settles all queued / failed / reversed payouts as test payments, so cron retries and alerts stop. */
export async function closeTestPayouts(note: string): Promise<ActionResult<{ closed: number }>> {
  const access = await assertPlatformStaff();
  if (!access.success) return { success: false, error: access.error };
  const result = await closeOpenPayouts(note);
  if (!result.ok) return { success: false, error: result.message };
  await prisma.auditLog.create({
    data: { userId: null, action: "PAYOUTS_TEST_CLOSED", entity: "Payout", entityId: "bulk", metadata: { note: note.trim(), closed: result.closed, ...access.actor } },
  });
  revalidatePath("/supaadmin/payouts");
  return { success: true, data: { closed: result.closed } };
}

export type PayoutWallet = {
  mode: PayoutMode;
  gateway: "PAYSTACK" | "FLUTTERWAVE" | "KORAPAY";
  /** Platform balance at the active gateway in naira, null when it couldn't be read. */
  gatewayBalance: number | null;
  heldTotal: number;
  heldCount: number;
  /** Payouts already queued (waiting for balance, bank details or a gateway fix). */
  queuedCount: number;
  /** Held money that no connected bank account can receive yet. */
  heldNoBank: number;
  stores: { storeId: string; name: string; slug: string; count: number; total: number; hasBank: boolean }[];
};

/** The payout wallet: money held for each store, plus the platform's gateway balance it will be paid from. */
export async function getPayoutWallet(): Promise<PayoutWallet | null> {
  const access = await assertPlatformStaff();
  if (!access.success) return null;

  const [mode, gateway, grouped, queuedCount] = await Promise.all([
    getPayoutMode(),
    getActiveGateway(),
    prisma.payout.groupBy({ by: ["storeId"], where: { status: "HELD" }, _sum: { amount: true }, _count: { _all: true } }),
    prisma.payout.count({ where: { status: "QUEUED" } }),
  ]);
  const stores = grouped.length
    ? await prisma.store.findMany({
        where: { id: { in: grouped.map((g) => g.storeId) } },
        select: { id: true, name: true, slug: true, payoutBankCode: true, payoutAccountNumber: true },
      })
    : [];
  const balanceKobo = await getGatewayBalanceKobo(gateway).catch(() => null);

  const rows = grouped
    .map((g) => {
      const s = stores.find((x) => x.id === g.storeId);
      return {
        storeId: g.storeId,
        name: s?.name ?? "Unknown store",
        slug: s?.slug ?? "",
        count: g._count._all,
        total: Number(g._sum.amount ?? 0),
        hasBank: Boolean(s?.payoutBankCode && s?.payoutAccountNumber),
      };
    })
    .sort((a, b) => b.total - a.total);

  return {
    mode,
    gateway,
    gatewayBalance: balanceKobo === null ? null : balanceKobo / 100,
    heldTotal: rows.reduce((n, r) => n + r.total, 0),
    heldCount: rows.reduce((n, r) => n + r.count, 0),
    queuedCount,
    heldNoBank: rows.filter((r) => !r.hasBank).reduce((n, r) => n + r.total, 0),
    stores: rows,
  };
}

export type ReleaseSummary = { released: number; paid: number; processing: number; stillQueued: number; failed: number };

async function release(storeId: string | undefined): Promise<ActionResult<ReleaseSummary>> {
  const access = await assertPlatformStaff();
  if (!access.success) return { success: false, error: access.error };

  const summary = await releaseHeldPayouts(storeId ? { storeId } : {});
  await prisma.auditLog.create({
    data: { userId: null, action: storeId ? "PAYOUTS_RELEASED_STORE" : "PAYOUTS_RELEASED_ALL", entity: storeId ? "Store" : "Payout", entityId: storeId ?? "all", metadata: { ...summary, ...access.actor } },
  });
  revalidatePath("/supaadmin/payouts");
  return { success: true, data: summary };
}

/** One click: queue and send everything held for one store. */
export async function releaseStorePayouts(storeId: string): Promise<ActionResult<ReleaseSummary>> {
  if (!storeId) return { success: false, error: "Store is required." };
  return release(storeId);
}

/** One click: queue and send everything held for every store. */
export async function releaseAllPayouts(): Promise<ActionResult<ReleaseSummary>> {
  return release(undefined);
}

/** One click: retry every queued payout now (skips the retry timer). Held payouts are released with the buttons above. */
export async function retryQueuedPayouts(): Promise<ActionResult<ReleaseSummary>> {
  const access = await assertPlatformStaff();
  if (!access.success) return { success: false, error: access.error };

  const summary = await retryQueuedPayoutsNow();
  await prisma.auditLog.create({
    data: { userId: null, action: "PAYOUTS_QUEUED_RETRIED", entity: "Payout", entityId: "all", metadata: { ...summary, ...access.actor } },
  });
  revalidatePath("/supaadmin/payouts");
  return { success: true, data: summary };
}
