import { prisma } from "@/lib/prisma";
import { tierState } from "@/lib/tickets";

/** Everything the tickets workspace shows, serialisable so it can cross to a client component. */
export async function loadTicketsWorkspace(storeId: string) {
  const now = new Date();
  const events = await prisma.ticketEvent.findMany({
    where: { storeId }, orderBy: { startsAt: "desc" }, take: 50,
    include: {
      tiers: { orderBy: { createdAt: "asc" } },
      orders: { where: { status: "PAID" }, select: { total: true } },
      tickets: { orderBy: { createdAt: "desc" }, take: 400, select: { id: true, code: true, holderName: true, status: true, checkedInAt: true, tier: { select: { name: true } }, order: { select: { buyerName: true, buyerEmail: true, receiptNo: true } } } },
    },
  });
  const checkedIn = await prisma.ticket.groupBy({ by: ["eventId"], where: { storeId, status: "CHECKED_IN" }, _count: { _all: true } });
  const checked = new Map(checkedIn.map((c) => [c.eventId, c._count._all]));
  return {
    events: events.map((e) => ({
      id: e.id, slug: e.slug, title: e.title, description: e.description, venue: e.venue, imageUrl: e.imageUrl, status: e.status,
      startsAt: e.startsAt.toISOString(), endsAt: e.endsAt ? e.endsAt.toISOString() : null,
      revenue: e.orders.reduce((s, o) => s + Number(o.total), 0),
      checkedIn: checked.get(e.id) ?? 0,
      tiers: e.tiers.map((t) => ({ id: t.id, name: t.name, price: Number(t.price), capacity: t.capacity, sold: t.sold, maxPerOrder: t.maxPerOrder, saleEndsAt: t.saleEndsAt ? t.saleEndsAt.toISOString() : null, active: t.active, state: tierState({ id: t.id, name: t.name, price: Number(t.price), capacity: t.capacity, sold: t.sold, maxPerOrder: t.maxPerOrder, saleEndsAt: t.saleEndsAt, active: t.active }, now) })),
      tickets: e.tickets.map((t) => ({ id: t.id, code: t.code, holder: t.holderName ?? t.order.buyerName, tier: t.tier.name, status: t.status, checkedInAt: t.checkedInAt ? t.checkedInAt.toISOString() : null, buyer: t.order.buyerName, email: t.order.buyerEmail, receiptNo: t.order.receiptNo })),
    })),
  };
}
export type TicketsWorkspaceData = Awaited<ReturnType<typeof loadTicketsWorkspace>>;
