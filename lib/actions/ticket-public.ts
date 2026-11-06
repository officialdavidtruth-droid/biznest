"use server";

import { headers } from "next/headers";
import { prisma } from "@/lib/prisma";
import { checkRateLimit, getClientIp } from "@/lib/rate-limit";
import { startTicketCharge } from "@/lib/payments/ticket-charge";
import { createHeldOrder, releaseStaleHolds, releaseTicketOrder } from "@/lib/payments/ticket-hold";
import { markTicketOrderPaid } from "@/lib/payments/ticket-receipt";
import { sendTicketEmailForOrder } from "@/lib/payments/ticket-confirmation";
import { TICKET_MIN_ONLINE_PAYMENT, eventOpenForSale, newAccessToken, priceOrder, sanitizeBuyer, ticketsPagePath } from "@/lib/tickets";
import type { ActionResult } from "@/types/actions";

async function callerIp() {
  try { return getClientIp(await headers()); } catch { return "unknown"; }
}

/**
 * A visitor buys tickets. Prices and availability come from the database, never the client. Seats are held while they
 * pay (the cron releases unpaid orders). Free events issue tickets straight away. Returns a checkout URL, or, for free
 * events, the tickets page.
 */
export async function buyTickets(slug: string, input: { eventId: string; lines: { tierId: string; qty: number }[]; name: string; email: string; phone?: string }): Promise<ActionResult<{ url: string }>> {
  const ip = await callerIp();
  const [byIp, byEmail] = await Promise.all([
    checkRateLimit(`tickets:ip:${ip}`, 15, 60 * 60 * 1000),
    checkRateLimit(`tickets:email:${String(input.email ?? "").toLowerCase().slice(0, 160)}`, 8, 60 * 60 * 1000),
  ]);
  if (!byIp.allowed || !byEmail.allowed) return { success: false, error: "Too many attempts. Please try again in a little while." };
  const buyer = sanitizeBuyer(input, true);
  if (!buyer.ok) return { success: false, error: buyer.error };
  const store = await prisma.store.findUnique({ where: { slug }, select: { id: true, slug: true, status: true, customDomain: true, customDomainStatus: true } });
  if (!store || store.status !== "ACTIVE") return { success: false, error: "This page isn't available." };
  await releaseStaleHolds(input.eventId).catch(() => null);
  const ev = await prisma.ticketEvent.findFirst({ where: { id: input.eventId, storeId: store.id }, include: { tiers: true } });
  if (!ev || !eventOpenForSale(ev)) return { success: false, error: "Ticket sales for this event are closed." };
  const priced = priceOrder(ev.tiers.map((t) => ({ id: t.id, name: t.name, price: Number(t.price), capacity: t.capacity, sold: t.sold, maxPerOrder: t.maxPerOrder, saleEndsAt: t.saleEndsAt, active: t.active })), input.lines);
  if (!priced.ok) return { success: false, error: priced.error };
  if (priced.total > 0 && priced.total < TICKET_MIN_ONLINE_PAYMENT) return { success: false, error: `Online payment starts at ${TICKET_MIN_ONLINE_PAYMENT}.` };

  // Cap unpaid holds per buyer so one person can't tie up a sold-out event.
  const open = await prisma.ticketOrder.count({ where: { eventId: ev.id, buyerEmail: buyer.buyer.email, status: "PENDING" } });
  if (open >= 3) return { success: false, error: "You have unfinished orders for this event. Please complete or wait for them to expire." };

  const held = await createHeldOrder({ storeId: store.id, eventId: ev.id, buyer: buyer.buyer, lines: priced.lines, total: priced.total, accessToken: newAccessToken() });
  if (!held.ok) return { success: false, error: held.error };
  const order = await prisma.ticketOrder.findUniqueOrThrow({ where: { id: held.orderId }, select: { accessToken: true } });

  if (priced.total === 0) {
    const receiptNo = await prisma.$transaction((tx) => markTicketOrderPaid(tx, { orderId: held.orderId, storeId: store.id, method: "COMP", note: "Free ticket" }));
    if (!receiptNo) { await releaseTicketOrder(held.orderId); return { success: false, error: "Could not issue your tickets. Please try again." }; }
    void sendTicketEmailForOrder(held.orderId);
    return { success: true, data: { url: ticketsPagePath(store.slug, order.accessToken) } };
  }

  const r = await startTicketCharge({ store, orderId: held.orderId, amount: priced.total, buyerName: buyer.buyer.name, buyerEmail: buyer.buyer.email });
  if (!r.success) { await releaseTicketOrder(held.orderId); return { success: false, error: r.error }; }
  return { success: true, data: { url: r.url } };
}
