"use server";

import { prisma } from "@/lib/prisma";
import { revalidatePath } from "next/cache";
import { auth } from "@/lib/auth";
import { assertAnyStorePermission } from "@/lib/access/assert-store-access";
import type { ActionResult } from "@/types/actions";

/**
 * "Post to room": charge a bill (invoice) or a POS order (restaurant, bar, room service) to a
 * checked-in hotel guest's folio instead of collecting payment now. The guest settles the whole
 * folio at checkout via settleFolio. Reuses the existing PropertyFolioCharge ledger.
 */

export type InHouseReservation = { id: string; roomName: string; guestName: string };

const POST_PERMS = ["orders", "pos", "finance"] as const;
const SETTLE_PERMS = ["payments", "finance", "orders"] as const;
const POSTABLE_ORDER_STATUSES = ["PAID", "IN_PROGRESS", "DELIVERED", "COMPLETED"] as const;

const money = (n: number) => Math.round(n * 100) / 100;

/** Guests currently checked in, for the "post to room" picker. Empty for non-hotel stores. */
export async function getInHouseReservations(slug: string): Promise<InHouseReservation[]> {
  const access = await assertAnyStorePermission(slug, [...POST_PERMS]);
  if (!access.success) return [];
  const rows = await prisma.propertyReservation.findMany({
    where: { storeId: access.store.id, status: "CHECKED_IN" },
    include: { room: { select: { name: true } }, guest: { select: { fullName: true } } },
    orderBy: { room: { name: "asc" } },
    take: 200,
  });
  return rows.map((r) => ({ id: r.id, roomName: r.room.name, guestName: r.guest.fullName }));
}

export async function postBillToRoom(
  slug: string,
  input: { kind: "invoice" | "order"; id: string; reservationId: string },
): Promise<ActionResult<{ roomName: string }>> {
  const access = await assertAnyStorePermission(slug, [...POST_PERMS]);
  if (!access.success) return { success: false, error: access.error };
  const store = access.store;

  const reservation = await prisma.propertyReservation.findFirst({
    where: { id: input.reservationId, storeId: store.id, status: "CHECKED_IN" },
    include: { room: { select: { name: true } }, guest: { select: { id: true, fullName: true } } },
  });
  if (!reservation) return { success: false, error: "That guest isn't checked in." };

  const sourceType = input.kind === "invoice" ? "INVOICE" : "ORDER";
  const already = await prisma.propertyFolioCharge.findFirst({
    where: { storeId: store.id, sourceType, sourceId: input.id, status: { not: "VOID" } },
    include: { reservation: { include: { room: { select: { name: true } } } } },
  });
  if (already) return { success: false, error: `Already posted to room ${already.reservation.room.name}. Void that charge first to move it.` };

  let lines: Array<{ description: string; quantity: number; unitAmount: number }> = [];
  let total = 0;
  let currency = store.currency;
  let label = "";

  if (input.kind === "invoice") {
    const invoice = await prisma.invoice.findFirst({ where: { id: input.id, storeId: store.id }, include: { items: true } });
    if (!invoice) return { success: false, error: "Bill not found." };
    if (invoice.status !== "DRAFT" && invoice.status !== "SENT") return { success: false, error: "Only an unpaid bill can be posted to a room." };
    lines = invoice.items.map((i) => ({ description: i.description, quantity: i.quantity, unitAmount: Number(i.unitPrice) }));
    total = Number(invoice.total);
    currency = invoice.currency;
    label = `Bill ${invoice.invoiceNo}`;
  } else {
    const order = await prisma.order.findFirst({
      where: { id: input.id, storeId: store.id, channel: "POS" },
      include: { items: { include: { product: { select: { name: true } }, service: { select: { name: true } } } } },
    });
    if (!order) return { success: false, error: "Only in-store (POS) orders can be posted to a room." };
    if (!(POSTABLE_ORDER_STATUSES as readonly string[]).includes(order.status)) return { success: false, error: "This order can't be posted to a room." };
    lines = order.items.map((i) => ({ description: i.product?.name ?? i.service?.name ?? "Item", quantity: i.quantity, unitAmount: Number(i.unitPrice) }));
    total = Number(order.total);
    currency = order.currency;
    label = `Order #${order.id.slice(-8).toUpperCase()}`;
  }

  // Taxes, delivery and discounts aren't line items, so any gap between the lines and the bill's
  // total becomes one adjustment line. The folio then always adds up to exactly what was billed.
  const linesSum = money(lines.reduce((s, l) => s + l.unitAmount * l.quantity, 0));
  const gap = money(total - linesSum);
  if (Math.abs(gap) > 0.009) lines.push({ description: "Taxes, fees & discounts", quantity: 1, unitAmount: gap });
  if (lines.length === 0) return { success: false, error: "This bill has nothing to post." };

  await prisma.$transaction(async (tx) => {
    await tx.propertyFolioCharge.createMany({
      data: lines.map((l) => ({
        storeId: store.id,
        reservationId: reservation.id,
        guestId: reservation.guest.id,
        description: l.description,
        category: label,
        quantity: l.quantity,
        unitAmount: l.unitAmount,
        amount: money(l.unitAmount * l.quantity),
        currency,
        sourceType,
        sourceId: input.id,
      })),
    });
    // The POS receipt shows how the sale was tendered.
    if (input.kind === "order") {
      await tx.order.update({ where: { id: input.id }, data: { posTenderType: `Room charge (${reservation.room.name})` } });
    }
  });

  revalidatePath(`/store/${slug}/admin/folio`);
  revalidatePath(`/store/${slug}/admin/invoices`);
  revalidatePath(`/store/${slug}/admin/orders`);
  return { success: true, data: { roomName: reservation.room.name } };
}

export async function voidFolioCharge(slug: string, chargeId: string): Promise<ActionResult> {
  const access = await assertAnyStorePermission(slug, [...SETTLE_PERMS]);
  if (!access.success) return { success: false, error: access.error };
  const res = await prisma.propertyFolioCharge.updateMany({
    where: { id: chargeId, storeId: access.store.id, status: "OPEN" },
    data: { status: "VOID", voidedAt: new Date() },
  });
  if (res.count === 0) return { success: false, error: "Only an open charge can be voided." };
  revalidatePath(`/store/${slug}/admin/folio`);
  revalidatePath(`/store/${slug}/admin/invoices`);
  return { success: true, data: undefined };
}

/** The guest has paid the room bill (usually at checkout): close every open charge on it. */
export async function settleFolio(slug: string, reservationId: string, method?: string): Promise<ActionResult<{ settled: number }>> {
  const access = await assertAnyStorePermission(slug, [...SETTLE_PERMS]);
  if (!access.success) return { success: false, error: access.error };
  const store = access.store;

  const open = await prisma.propertyFolioCharge.findMany({ where: { storeId: store.id, reservationId, status: "OPEN" } });
  if (open.length === 0) return { success: false, error: "Nothing is owing on this room bill." };

  const note = typeof method === "string" ? method.trim().slice(0, 60) : "";
  const userId = (await auth())?.user?.id ?? null;
  const invoiceIds = [...new Set(open.filter((c) => c.sourceType === "INVOICE" && c.sourceId).map((c) => c.sourceId as string))];

  await prisma.$transaction(async (tx) => {
    const now = new Date();
    await tx.propertyFolioCharge.updateMany({ where: { id: { in: open.map((c) => c.id) }, status: "OPEN" }, data: { status: "PAID", paidAt: now } });

    // A bill that was posted to the room is paid now. Mirrors markInvoicePaid, and is skipped for
    // any bill that was settled some other way in the meantime.
    for (const invoiceId of invoiceIds) {
      const invoice = await tx.invoice.findFirst({ where: { id: invoiceId, storeId: store.id } });
      if (!invoice) continue;
      const claimed = await tx.invoice.updateMany({ where: { id: invoiceId, status: { in: ["DRAFT", "SENT"] } }, data: { status: "PAID", paidAt: now } });
      if (claimed.count === 0) continue;
      const payment = await tx.payment.create({
        data: {
          storeId: store.id,
          purpose: "INVOICE",
          provider: "CASH",
          reference: `MANUAL-INV-${invoice.id}`,
          status: "SUCCESSFUL",
          amount: invoice.total,
          currency: invoice.currency,
          verifiedAt: now,
          rawPayload: { manual: true, method: note || "Settled with room bill", markedByUserId: userId },
        },
      });
      await tx.invoice.update({ where: { id: invoiceId }, data: { paymentId: payment.id } });
    }
  });

  revalidatePath(`/store/${slug}/admin/folio`);
  revalidatePath(`/store/${slug}/admin/invoices`);
  return { success: true, data: { settled: open.length } };
}
