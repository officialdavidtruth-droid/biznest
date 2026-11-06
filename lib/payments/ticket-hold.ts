import "server-only";
import { prisma } from "@/lib/prisma";
import { TICKET_HOLD_MINUTES } from "@/lib/tickets";

/**
 * Holds `qty` seats in a tier. One atomic statement checks capacity and increments, so two buyers racing for the last
 * seats cannot both get them. Returns false (and holds nothing) when there is not enough room.
 */
export async function holdSeats(tx: Pick<typeof prisma, "$executeRaw">, tierId: string, qty: number): Promise<boolean> {
  const n = await tx.$executeRaw`UPDATE "TicketTier" SET "sold" = "sold" + ${qty} WHERE "id" = ${tierId} AND "active" = true AND "sold" + ${qty} <= "capacity"`;
  return n === 1;
}

export async function returnSeats(tx: Pick<typeof prisma, "$executeRaw">, tierId: string, qty: number): Promise<void> {
  await tx.$executeRaw`UPDATE "TicketTier" SET "sold" = GREATEST("sold" - ${qty}, 0) WHERE "id" = ${tierId}`;
}

/** Cancels an unpaid order and gives its seats back. Safe to call twice: only the call that flips PENDING to CANCELLED returns seats. */
export async function releaseTicketOrder(orderId: string): Promise<boolean> {
  return prisma.$transaction(async (tx) => {
    const res = await tx.ticketOrder.updateMany({ where: { id: orderId, status: "PENDING" }, data: { status: "CANCELLED" } });
    if (res.count !== 1) return false;
    const items = await tx.ticketOrderItem.findMany({ where: { orderId }, select: { tierId: true, qty: true } });
    for (const it of items) await returnSeats(tx, it.tierId, it.qty);
    return true;
  });
}

type Line = { tierId: string; qty: number; unitPrice: number };

/**
 * Creates a PENDING order and holds its seats in one transaction. If any tier is short, the whole transaction rolls back
 * and nothing is held. Returns the new order's id and access token.
 */
export async function createHeldOrder(input: {
  storeId: string; eventId: string; buyer: { name: string; email: string | null; phone: string | null }; lines: Line[]; total: number; accessToken: string;
}): Promise<{ ok: true; orderId: string } | { ok: false; error: string }> {
  try {
    const orderId = await prisma.$transaction(async (tx) => {
      for (const l of input.lines) {
        if (!(await holdSeats(tx, l.tierId, l.qty))) throw new SoldOutError();
      }
      const o = await tx.ticketOrder.create({
        data: {
          storeId: input.storeId, eventId: input.eventId, buyerName: input.buyer.name, buyerEmail: input.buyer.email, buyerPhone: input.buyer.phone,
          total: input.total, accessToken: input.accessToken, items: { create: input.lines.map((l) => ({ tierId: l.tierId, qty: l.qty, unitPrice: l.unitPrice })) },
        },
        select: { id: true },
      });
      return o.id;
    });
    return { ok: true, orderId };
  } catch (err) {
    if (err instanceof SoldOutError) return { ok: false, error: "Sorry, those tickets just sold out. Please pick fewer or another type." };
    throw err;
  }
}

class SoldOutError extends Error {}

const HOLD_MS = TICKET_HOLD_MINUTES * 60_000;
const IN_FLIGHT_MS = 4 * 3_600_000;

/**
 * Releases unpaid orders older than the hold time (optionally for one event). An order whose gateway payment is still
 * pending is kept for a further 4 hours so reconciliation can confirm it. Called lazily when someone buys, and by the
 * daily cron, so abandoned checkouts never keep an event looking sold out.
 */
export async function releaseStaleHolds(eventId?: string): Promise<{ released: number; kept: number; failures: number }> {
  const stale = await prisma.ticketOrder.findMany({
    where: { status: "PENDING", createdAt: { lt: new Date(Date.now() - HOLD_MS) }, ...(eventId ? { eventId } : {}), payments: { none: { status: "SUCCESSFUL" } } },
    select: { id: true, createdAt: true, payments: { where: { status: "PENDING", provider: { not: "CASH" } }, select: { id: true } } },
    take: 300,
  });
  let released = 0, kept = 0, failures = 0;
  for (const o of stale) {
    if (o.payments.length > 0 && o.createdAt.getTime() > Date.now() - IN_FLIGHT_MS) { kept++; continue; }
    try { if (await releaseTicketOrder(o.id)) released++; } catch { failures++; }
  }
  return { released, kept, failures };
}
