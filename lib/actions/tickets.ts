"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { assertStorePermission } from "@/lib/access/assert-store-access";
import { markTicketOrderPaid } from "@/lib/payments/ticket-receipt";
import { createHeldOrder, releaseTicketOrder, returnSeats } from "@/lib/payments/ticket-hold";
import { sendTicketEmailForOrder } from "@/lib/payments/ticket-confirmation";
import {
  EVENT_STATUSES, TICKET_PAYMENT_METHODS, isTicketCode, newAccessToken, normaliseCode, priceOrder, sanitizeBuyer, sanitizeEvent, sanitizeTier, scanVerdict, slugifyTitle,
} from "@/lib/tickets";
import type { ActionResult } from "@/types/actions";

// Organiser side of event ticketing. Every query is scoped to the caller's store.

const fail = (error: string): ActionResult<never> => ({ success: false, error });
const refresh = (slug: string) => revalidatePath(`/store/${slug}/admin/tickets`);
const access = (slug: string) => assertStorePermission(slug, "products");

async function uniqueSlug(storeId: string, title: string): Promise<string> {
  const base = slugifyTitle(title);
  for (let i = 0; i < 20; i++) {
    const candidate = i === 0 ? base : `${base}-${i + 1}`;
    if (!(await prisma.ticketEvent.findUnique({ where: { storeId_slug: { storeId, slug: candidate } }, select: { id: true } }))) return candidate;
  }
  return `${base}-${Date.now().toString(36)}`;
}

export async function createTicketEvent(slug: string, input: { title: string; description?: string; venue?: string; startsAt: string; endsAt?: string; imageUrl?: string }): Promise<ActionResult<{ id: string }>> {
  const a = await access(slug); if (!a.success) return fail(a.error);
  const e = sanitizeEvent(input); if (!e.ok) return fail(e.error);
  const row = await prisma.ticketEvent.create({ data: { storeId: a.store.id, slug: await uniqueSlug(a.store.id, e.event.title), ...e.event, imageUrl: input.imageUrl?.trim().slice(0, 500) || null }, select: { id: true } });
  refresh(slug);
  return { success: true, data: { id: row.id } };
}

export async function updateTicketEvent(slug: string, eventId: string, input: { title: string; description?: string; venue?: string; startsAt: string; endsAt?: string; imageUrl?: string }): Promise<ActionResult> {
  const a = await access(slug); if (!a.success) return fail(a.error);
  const e = sanitizeEvent(input); if (!e.ok) return fail(e.error);
  const res = await prisma.ticketEvent.updateMany({ where: { id: eventId, storeId: a.store.id }, data: { ...e.event, imageUrl: input.imageUrl?.trim().slice(0, 500) || null } });
  if (res.count === 0) return fail("Event not found.");
  refresh(slug);
  return { success: true, data: undefined };
}

export async function setTicketEventStatus(slug: string, eventId: string, status: string): Promise<ActionResult> {
  const a = await access(slug); if (!a.success) return fail(a.error);
  if (!(EVENT_STATUSES as readonly string[]).includes(status)) return fail("Choose a valid status.");
  if (status === "PUBLISHED") {
    const tiers = await prisma.ticketTier.count({ where: { eventId, storeId: a.store.id, active: true } });
    if (tiers === 0) return fail("Add at least one ticket type before publishing.");
  }
  const res = await prisma.ticketEvent.updateMany({ where: { id: eventId, storeId: a.store.id }, data: { status } });
  if (res.count === 0) return fail("Event not found.");
  refresh(slug);
  return { success: true, data: undefined };
}

export async function addTicketTier(slug: string, eventId: string, input: { name: string; price?: number; capacity: number; maxPerOrder?: number; saleEndsAt?: string }): Promise<ActionResult> {
  const a = await access(slug); if (!a.success) return fail(a.error);
  const ev = await prisma.ticketEvent.findFirst({ where: { id: eventId, storeId: a.store.id }, select: { id: true } });
  if (!ev) return fail("Event not found.");
  const t = sanitizeTier(input); if (!t.ok) return fail(t.error);
  await prisma.ticketTier.create({ data: { storeId: a.store.id, eventId: ev.id, ...t.tier } });
  refresh(slug);
  return { success: true, data: undefined };
}

/** Capacity can't drop below what is already sold or held. Price changes only affect future orders. */
export async function updateTicketTier(slug: string, tierId: string, input: { name: string; price?: number; capacity: number; maxPerOrder?: number; saleEndsAt?: string; active?: boolean }): Promise<ActionResult> {
  const a = await access(slug); if (!a.success) return fail(a.error);
  const tier = await prisma.ticketTier.findFirst({ where: { id: tierId, storeId: a.store.id } });
  if (!tier) return fail("Ticket type not found.");
  const t = sanitizeTier(input); if (!t.ok) return fail(t.error);
  if (t.tier.capacity < tier.sold) return fail(`${tier.sold} are already sold or held, so capacity can't go below that.`);
  await prisma.ticketTier.update({ where: { id: tier.id }, data: { ...t.tier, ...(input.active !== undefined ? { active: input.active } : {}) } });
  refresh(slug);
  return { success: true, data: undefined };
}

type SaleInput = { eventId: string; lines: { tierId: string; qty: number }[]; name: string; email?: string; phone?: string; method: string; note?: string };

async function issuePaidOrder(storeId: string, input: SaleInput, free: boolean): Promise<ActionResult<{ orderId: string; receiptNo: string; count: number }>> {
  if (!(TICKET_PAYMENT_METHODS as readonly string[]).includes(input.method)) return fail("Choose how it was paid.");
  const buyer = sanitizeBuyer(input, false); if (!buyer.ok) return fail(buyer.error);
  const ev = await prisma.ticketEvent.findFirst({ where: { id: input.eventId, storeId, status: { not: "CANCELLED" } }, include: { tiers: true } });
  if (!ev) return fail("Event not found.");
  const priced = priceOrder(ev.tiers.map((t) => ({ id: t.id, name: t.name, price: Number(t.price), capacity: t.capacity, sold: t.sold, maxPerOrder: 1000, saleEndsAt: null, active: t.active })), input.lines);
  if (!priced.ok) return fail(priced.error);
  const total = free ? 0 : priced.total;
  const held = await createHeldOrder({ storeId, eventId: ev.id, buyer: buyer.buyer, lines: priced.lines, total, accessToken: newAccessToken() });
  if (!held.ok) return fail(held.error);
  const receiptNo = await prisma.$transaction((tx) => markTicketOrderPaid(tx, { orderId: held.orderId, storeId, method: free ? "COMP" : input.method, note: input.note?.trim().slice(0, 300) || null }));
  if (!receiptNo) { await releaseTicketOrder(held.orderId); return fail("Could not issue the tickets. Please try again."); }
  if (buyer.buyer.email) void sendTicketEmailForOrder(held.orderId);
  return { success: true, data: { orderId: held.orderId, receiptNo, count: priced.count } };
}

/** A sale taken at the door or by phone: marks it paid at once and issues the tickets. */
export async function recordTicketSale(slug: string, input: SaleInput): Promise<ActionResult<{ receiptNo: string; count: number }>> {
  const a = await access(slug); if (!a.success) return fail(a.error);
  const r = await issuePaidOrder(a.store.id, input, false);
  if (!r.success) return fail(r.error);
  refresh(slug);
  return { success: true, data: { receiptNo: r.data.receiptNo, count: r.data.count } };
}

/** Guest list: one complimentary ticket per line ("Name" or "Name, email"). */
export async function addGuests(slug: string, eventId: string, tierId: string, guestLines: string): Promise<ActionResult<{ added: number }>> {
  const a = await access(slug); if (!a.success) return fail(a.error);
  const lines = guestLines.split(/\r?\n/).map((l) => l.trim()).filter(Boolean).slice(0, 200);
  if (lines.length === 0) return fail("Enter at least one guest name.");
  let added = 0;
  for (const line of lines) {
    const [name, email] = line.split(/[,\t]/).map((x) => x.trim());
    const r = await issuePaidOrder(a.store.id, { eventId, lines: [{ tierId, qty: 1 }], name, email, method: "COMP" }, true);
    if (!r.success) { refresh(slug); return fail(`${added} added. Stopped at "${name}": ${r.error}`); }
    added++;
  }
  refresh(slug);
  return { success: true, data: { added } };
}

/** Voids one ticket (lost, duplicate, refunded). The seat is freed. Refunding money is done outside the platform. */
export async function voidTicket(slug: string, ticketId: string): Promise<ActionResult> {
  const a = await access(slug); if (!a.success) return fail(a.error);
  const t = await prisma.ticket.findFirst({ where: { id: ticketId, storeId: a.store.id } });
  if (!t) return fail("Ticket not found.");
  if (t.status !== "VALID") return fail(t.status === "CHECKED_IN" ? "This ticket was already used." : "This ticket is already cancelled.");
  const done = await prisma.$transaction(async (tx) => {
    const res = await tx.ticket.updateMany({ where: { id: t.id, status: "VALID" }, data: { status: "VOID" } });
    if (res.count !== 1) return false;
    await returnSeats(tx, t.tierId, 1);
    return true;
  });
  if (!done) return fail("This ticket changed. Refresh and try again.");
  refresh(slug);
  return { success: true, data: undefined };
}

/** The gate: checks a scanned or typed code and, if valid, marks it used in one atomic step so two phones can't both admit it. */
export async function scanTicket(slug: string, eventId: string, rawCode: string): Promise<ActionResult<{ message: string; admitted: boolean; reason?: string }>> {
  const a = await access(slug); if (!a.success) return fail(a.error);
  const ev = await prisma.ticketEvent.findFirst({ where: { id: eventId, storeId: a.store.id }, select: { id: true, status: true } });
  if (!ev) return fail("Event not found.");
  const code = normaliseCode(rawCode);
  if (!isTicketCode(code)) return { success: true, data: { admitted: false, reason: "NOT_FOUND", message: "That doesn't look like a ticket code." } };
  const ticket = await prisma.ticket.findFirst({ where: { code, storeId: a.store.id }, include: { tier: { select: { name: true } } } });
  const verdict = scanVerdict(ticket ? { status: ticket.status, checkedInAt: ticket.checkedInAt, holderName: ticket.holderName, tierName: ticket.tier.name, eventId: ticket.eventId } : null, ev);
  if (!verdict.ok) return { success: true, data: { admitted: false, reason: verdict.reason, message: verdict.message } };
  const res = await prisma.ticket.updateMany({ where: { id: ticket!.id, status: "VALID" }, data: { status: "CHECKED_IN", checkedInAt: new Date() } });
  if (res.count !== 1) return { success: true, data: { admitted: false, reason: "ALREADY_IN", message: "Already used just now." } };
  refresh(slug);
  return { success: true, data: { admitted: true, message: verdict.message } };
}
