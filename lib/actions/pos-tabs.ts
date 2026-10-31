"use server";

import { prisma } from "@/lib/prisma";
import { revalidatePath } from "next/cache";
import { auth } from "@/lib/auth";
import { assertAnyStorePermission } from "@/lib/access/assert-store-access";
import { postOrderSaleToLedger } from "@/lib/financial/order-ledger";
import { emitWebhookEvent } from "@/lib/webhooks/dispatch";
import { logStoreActivity } from "@/lib/activity-log";
import { logError, errorMeta } from "@/lib/observability/log";
import { roundMoney } from "@/lib/utils/pricing";
import { posTenderTypes } from "@/lib/validations/pos";
import type { ActionResult } from "@/types/actions";

/**
 * Table tabs: a running bill per table. createPosSale (chargeTo: TABLE) adds each round of
 * orders to the table's open PosTab; here the tab is read back, then closed once — either paid
 * (cash/card/transfer) or moved onto a checked-in guest's room. Money is only recorded at
 * that point: one Payment per order and its ledger entry, so unpaid tabs never count as cash.
 */

const TAB_PERMS = ["pos", "orders", "payments", "finance"] as const;
// Orders on a tab that still count as sales (a cancelled/refunded order isn't billed).
const BILLABLE = ["PAID", "IN_PROGRESS", "DELIVERED", "COMPLETED"] as const;

class TabError extends Error {}

export type PosTabOrder = {
  id: string;
  code: string;
  createdAt: string;
  total: number;
  items: { name: string; quantity: number; unitPrice: number }[];
};

export type PosTabSummary = {
  id: string;
  label: string;
  customerName: string | null;
  openedAt: string;
  currency: string;
  total: number;
  orders: PosTabOrder[];
};

/** Every table with a running bill, oldest first. Tabs nothing was ever added to are left out. */
export async function getOpenPosTabs(slug: string): Promise<PosTabSummary[]> {
  const access = await assertAnyStorePermission(slug, [...TAB_PERMS]);
  if (!access.success) return [];
  const tabs = await prisma.posTab.findMany({
    where: { storeId: access.store.id, status: "OPEN", orders: { some: { status: { in: [...BILLABLE] } } } },
    orderBy: { openedAt: "asc" },
    take: 100,
    include: {
      orders: {
        where: { status: { in: [...BILLABLE] } },
        orderBy: { createdAt: "asc" },
        include: { items: { include: { product: { select: { name: true } }, variant: { select: { label: true } }, service: { select: { name: true } } } } },
      },
    },
  });
  return tabs.map((t) => ({
    id: t.id,
    label: t.label,
    customerName: t.customerName,
    openedAt: t.openedAt.toISOString(),
    currency: t.orders[0]?.currency ?? access.store.currency,
    total: roundMoney(t.orders.reduce((s, o) => s + Number(o.total), 0)),
    orders: t.orders.map((o) => ({
      id: o.id,
      code: o.id.slice(-8).toUpperCase(),
      createdAt: o.createdAt.toISOString(),
      total: Number(o.total),
      items: o.items.map((i) => ({
        name: i.product ? (i.variant ? `${i.product.name} — ${i.variant.label}` : i.product.name) : i.service?.name ?? "Item",
        quantity: i.quantity,
        unitPrice: Number(i.unitPrice),
      })),
    })),
  }));
}

/** Pay the whole table bill: closes the tab and records one Payment per order. */
export async function settlePosTab(slug: string, tabId: string, tender: string): Promise<ActionResult<{ total: number }>> {
  const access = await assertAnyStorePermission(slug, [...TAB_PERMS]);
  if (!access.success) return { success: false, error: access.error };
  if (!(posTenderTypes as readonly string[]).includes(tender)) return { success: false, error: "Choose how the guest paid." };
  const store = access.store;
  const userId = (await auth())?.user?.id ?? null;

  let settled: { id: string; total: number; currency: string }[];
  let label = "";
  try {
    const result = await prisma.$transaction(async (tx) => {
      const now = new Date();
      // Closing the tab is the claim: a second click, or a second device, gets count 0.
      const claimed = await tx.posTab.updateMany({
        where: { id: tabId, storeId: store.id, status: "OPEN" },
        data: { status: "SETTLED", settledAt: now, settledTender: tender, settledByUserId: userId },
      });
      if (claimed.count === 0) throw new TabError("This table's bill is already closed.");
      const tab = await tx.posTab.findUniqueOrThrow({ where: { id: tabId }, select: { label: true } });
      const orders = await tx.order.findMany({
        where: { posTabId: tabId, storeId: store.id, status: { in: [...BILLABLE] } },
        select: { id: true, total: true, currency: true },
      });
      if (orders.length === 0) throw new TabError("Nothing is owing on this table.");
      for (const o of orders) {
        // The tender now says how it was really paid (the ledger books Cash vs Bank off it).
        await tx.order.update({ where: { id: o.id }, data: { posTenderType: tender } });
        await tx.payment.create({
          data: {
            orderId: o.id,
            storeId: store.id,
            purpose: "ORDER",
            provider: "CASH",
            reference: `POS-${o.id}`,
            status: "SUCCESSFUL",
            amount: o.total,
            currency: o.currency,
            verifiedAt: now,
            rawPayload: { tab: tabId, tender, settledByUserId: userId },
          },
        });
      }
      return { label: tab.label, orders: orders.map((o) => ({ id: o.id, total: Number(o.total), currency: o.currency })) };
    });
    settled = result.orders;
    label = result.label;
  } catch (err) {
    if (err instanceof TabError) return { success: false, error: err.message };
    throw err;
  }

  const total = roundMoney(settled.reduce((s, o) => s + o.total, 0));
  for (const o of settled) {
    await postOrderSaleToLedger(o.id); // never throws; idempotent per order
    try {
      await emitWebhookEvent("PAYMENT_SUCCESS", store.id, { orderId: o.id, amount: o.total, currency: o.currency, provider: "CASH" });
    } catch (err) {
      await logError("JOBS", "pos tab: webhook emit failed after committed settlement", errorMeta(err, { orderId: o.id }));
    }
  }
  await logTabActivity(store.id, "pos.tab_settled", label, { tabId, total, tender, orders: settled.length });
  revalidateAfterTab(slug);
  return { success: true, data: { total } };
}

/** Put the whole table bill on a checked-in guest's room instead of taking payment now. */
export async function postPosTabToRoom(slug: string, tabId: string, reservationId: string): Promise<ActionResult<{ roomName: string; total: number }>> {
  const access = await assertAnyStorePermission(slug, [...TAB_PERMS]);
  if (!access.success) return { success: false, error: access.error };
  const store = access.store;
  const userId = (await auth())?.user?.id ?? null;

  const reservation = await prisma.propertyReservation.findFirst({
    where: { id: reservationId, storeId: store.id, status: "CHECKED_IN" },
    select: { id: true, guestId: true, room: { select: { name: true } } },
  });
  if (!reservation) return { success: false, error: "That guest isn't checked in." };
  const tender = `Room charge (${reservation.room.name})`;

  let label = "";
  let total = 0;
  try {
    const result = await prisma.$transaction(async (tx) => {
      const claimed = await tx.posTab.updateMany({
        where: { id: tabId, storeId: store.id, status: "OPEN" },
        data: { status: "SETTLED", settledAt: new Date(), settledTender: tender, settledByUserId: userId },
      });
      if (claimed.count === 0) throw new TabError("This table's bill is already closed.");
      const tab = await tx.posTab.findUniqueOrThrow({ where: { id: tabId }, select: { label: true } });
      const orders = await tx.order.findMany({
        where: { posTabId: tabId, storeId: store.id, status: { in: [...BILLABLE] } },
        include: { items: { include: { product: { select: { name: true } }, variant: { select: { label: true } }, service: { select: { name: true } } } } },
      });
      if (orders.length === 0) throw new TabError("Nothing is owing on this table.");

      const charges = orders.flatMap((o) => {
        const lines = o.items.map((i) => {
          const name = i.product ? (i.variant ? `${i.product.name} — ${i.variant.label}` : i.product.name) : i.service?.name ?? "Item";
          return { description: name, quantity: i.quantity, unitAmount: Number(i.unitPrice) };
        });
        const gap = roundMoney(Number(o.total) - roundMoney(lines.reduce((s, l) => s + l.unitAmount * l.quantity, 0)));
        if (Math.abs(gap) > 0.009) lines.push({ description: "Taxes, fees & discounts", quantity: 1, unitAmount: gap });
        return lines.map((l) => ({
          storeId: store.id,
          reservationId: reservation.id,
          guestId: reservation.guestId,
          description: l.description,
          category: `${tab.label} · Order #${o.id.slice(-8).toUpperCase()}`,
          quantity: l.quantity,
          unitAmount: l.unitAmount,
          amount: roundMoney(l.unitAmount * l.quantity),
          currency: o.currency,
          sourceType: "ORDER",
          sourceId: o.id,
        }));
      });
      await tx.propertyFolioCharge.createMany({ data: charges });
      await tx.order.updateMany({ where: { id: { in: orders.map((o) => o.id) } }, data: { posTenderType: tender } });
      return { label: tab.label, total: roundMoney(orders.reduce((s, o) => s + Number(o.total), 0)) };
    });
    label = result.label;
    total = result.total;
  } catch (err) {
    if (err instanceof TabError) return { success: false, error: err.message };
    throw err;
  }

  await logTabActivity(store.id, "pos.tab_posted_to_room", label, { tabId, total, room: reservation.room.name });
  revalidateAfterTab(slug);
  revalidatePath(`/store/${slug}/admin/folio`);
  return { success: true, data: { roomName: reservation.room.name, total } };
}

async function logTabActivity(storeId: string, action: string, label: string, metadata: Record<string, unknown>) {
  const session = await auth();
  await logStoreActivity({
    storeId,
    actor: { id: session?.user?.id, name: session?.user?.name, email: session?.user?.email, role: session?.user?.role ?? "unknown" },
    action,
    target: `Table ${label}`,
    metadata,
  });
}

function revalidateAfterTab(slug: string) {
  revalidatePath(`/store/${slug}/admin/pos`);
  revalidatePath(`/store/${slug}/admin/fnb`);
  revalidatePath(`/store/${slug}/admin/orders`);
}
