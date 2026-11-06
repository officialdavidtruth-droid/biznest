import "server-only";
import type { Prisma } from "@prisma/client";
import { receiptNumber, lastReceiptSeq, newTicketCode } from "@/lib/tickets";

/**
 * Marks one PENDING ticket order as paid, gives it the store's next receipt number and creates its tickets, all in the
 * caller's transaction. Returns the receipt number, or null when the order was not PENDING (already paid or expired), so
 * nothing is issued twice. The (storeId, receiptNo) unique index makes two simultaneous settlements fail loudly.
 */
export async function markTicketOrderPaid(
  tx: Prisma.TransactionClient,
  input: { orderId: string; storeId: string; method: string; reference?: string | null; note?: string | null; paidAt?: Date }
): Promise<string | null> {
  const latest = await tx.ticketOrder.findMany({ where: { storeId: input.storeId, receiptNo: { not: null } }, orderBy: { receiptNo: "desc" }, take: 1, select: { receiptNo: true } });
  const receiptNo = receiptNumber(lastReceiptSeq(latest.map((r) => r.receiptNo)) + 1);
  const res = await tx.ticketOrder.updateMany({
    where: { id: input.orderId, storeId: input.storeId, status: "PENDING" },
    data: { status: "PAID", paidAt: input.paidAt ?? new Date(), method: input.method, reference: input.reference ?? null, note: input.note ?? undefined, receiptNo },
  });
  if (res.count !== 1) return null;
  const order = await tx.ticketOrder.findUniqueOrThrow({ where: { id: input.orderId }, select: { eventId: true, buyerName: true, items: { select: { tierId: true, qty: true } } } });
  const rows: Prisma.TicketCreateManyInput[] = [];
  for (const it of order.items) {
    for (let i = 0; i < it.qty; i++) rows.push({ storeId: input.storeId, eventId: order.eventId, tierId: it.tierId, orderId: input.orderId, code: newTicketCode(), holderName: order.buyerName });
  }
  if (rows.length) await tx.ticket.createMany({ data: rows });
  return receiptNo;
}
