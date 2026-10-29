import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { logError, errorMeta } from "@/lib/observability/log";

/**
 * Posts paid orders (and their refunds) to the Financial Control ledger so
 * "Recorded revenue" matches the sales shown on the dashboards.
 *
 * Rules:
 *  - Sale: Dr Cash (1000) for CASH payments (POS), else Dr Bank (1010);
 *    Cr Product Sales (4000), or Service Revenue (4100) when the order has
 *    only service lines. Gross order total. Gateway fees/commission are not booked.
 *  - Service bookings and property (hotel) reservations are posted from their
 *    Payment row (`PAY-<paymentId>`): Dr Bank (1010; Cash 1000 for CASH),
 *    Cr Service Revenue (4100) for bookings or Room Revenue (4200) for
 *    reservations, for the amount actually paid (a deposit posts as paid).
 *  - Refund: exact reversal of the sale entry.
 *  - Idempotent: references `ORD-<orderId>` / `ORD-REF-<orderId>` are unique per
 *    store, so replays, webhooks retried and backfills never double-post.
 *  - Only stores that have opened Financial Control (chart of accounts exists)
 *    are posted for; others are skipped silently.
 *  - A CLOSED period is never touched: such entries are dated now instead.
 *  - Best-effort: never throws, so a ledger problem can't break a payment.
 */

export const LEDGER_SALE_STATUSES = ["PAID", "IN_PROGRESS", "DELIVERED", "COMPLETED"] as const;
const SALE_REF = (orderId: string) => `ORD-${orderId}`;
const REFUND_REF = (orderId: string) => `ORD-REF-${orderId}`;
const PAY_REF = (paymentId: string) => `PAY-${paymentId}`;
const PAY_REFUND_REF = (paymentId: string) => `PAY-REF-${paymentId}`;
const CODES = ["1000", "1010", "4000", "4100", "4200"];

async function loadAccounts(storeId: string): Promise<Map<string, string> | null> {
  const rows = await prisma.financialAccount.findMany({ where: { storeId, code: { in: CODES }, isActive: true }, select: { id: true, code: true } });
  const map = new Map(rows.map((r) => [r.code, r.id]));
  return CODES.every((c) => map.has(c)) ? map : null;
}

async function createEntry(storeId: string, reference: string, description: string, wantedDate: Date, lines: { accountId: string; debit: number; credit: number }[]): Promise<boolean> {
  let entryDate = wantedDate;
  let period = await prisma.financialPeriod.findFirst({ where: { storeId, startsAt: { lte: entryDate }, endsAt: { gte: entryDate } } });
  if (period?.status === "CLOSED") {
    entryDate = new Date();
    period = await prisma.financialPeriod.findFirst({ where: { storeId, startsAt: { lte: entryDate }, endsAt: { gte: entryDate }, status: "OPEN" } });
  }
  try {
    await prisma.financialJournalEntry.create({
      data: { storeId, periodId: period?.id, reference, description, entryDate, status: "POSTED", postedAt: new Date(), lines: { create: lines } },
    });
    return true;
  } catch (err) {
    if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === "P2002") return false; // already posted
    throw err;
  }
}

/** Posts the sale entry for a paid order. `entryDate` defaults to now (live); backfill passes the order date. */
export async function postOrderSaleToLedger(orderId: string, entryDate: Date = new Date()): Promise<void> {
  try {
    const order = await prisma.order.findUnique({
      where: { id: orderId },
      select: { id: true, storeId: true, total: true, status: true, channel: true, items: { select: { productId: true, serviceId: true } } },
    });
    if (!order) return;
    if (!([...LEDGER_SALE_STATUSES, "REFUNDED"] as string[]).includes(order.status)) return;
    const total = Number(order.total);
    if (!(total > 0)) return;
    const accounts = await loadAccounts(order.storeId);
    if (!accounts) return;
    const payment = await prisma.payment.findFirst({ where: { orderId: order.id }, orderBy: { createdAt: "asc" }, select: { provider: true } });
    const debitId = accounts.get(payment?.provider === "CASH" && order.channel !== "ONLINE" ? "1000" : "1010")!; // online CASH = vendor-confirmed bank transfer -> bank account
    const serviceOnly = order.items.length > 0 && order.items.every((i) => i.serviceId && !i.productId);
    const revenueId = accounts.get(serviceOnly ? "4100" : "4000")!;
    await createEntry(order.storeId, SALE_REF(order.id), `Sale: order ${order.id}`, entryDate, [
      { accountId: debitId, debit: total, credit: 0 },
      { accountId: revenueId, debit: 0, credit: total },
    ]);
  } catch (err) {
    void logError("JOBS", "order-ledger: sale posting failed", errorMeta(err, { orderId }));
  }
}

/** Reverses a refunded order's sale entry (posting the sale first if it was never recorded). */
export async function postOrderRefundToLedger(orderId: string, entryDate: Date = new Date()): Promise<void> {
  try {
    const order = await prisma.order.findUnique({ where: { id: orderId }, select: { id: true, storeId: true, createdAt: true } });
    if (!order) return;
    if (!(await loadAccounts(order.storeId))) return;
    await postOrderSaleToLedger(order.id, order.createdAt);
    const sale = await prisma.financialJournalEntry.findUnique({
      where: { storeId_reference: { storeId: order.storeId, reference: SALE_REF(order.id) } },
      select: { lines: { select: { accountId: true, debit: true, credit: true } } },
    });
    if (!sale) return;
    await createEntry(order.storeId, REFUND_REF(order.id), `Refund: order ${order.id}`, entryDate,
      sale.lines.map((l) => ({ accountId: l.accountId, debit: Number(l.credit), credit: Number(l.debit) })));
  } catch (err) {
    void logError("JOBS", "order-ledger: refund posting failed", errorMeta(err, { orderId }));
  }
}

const PAYMENT_SELECT = { id: true, storeId: true, amount: true, provider: true, status: true, bookingId: true, reservationId: true, orderId: true, verifiedAt: true, createdAt: true, refundedAt: true } as const;
const PAYMENT_POSTABLE = ["SUCCESSFUL", "REFUND_PENDING", "REFUNDED"];

/** Posts a booking/reservation payment (order payments are handled by postOrderSaleToLedger). */
export async function postPaymentToLedger(paymentId: string, entryDate?: Date): Promise<void> {
  try {
    const payment = await prisma.payment.findUnique({ where: { id: paymentId }, select: PAYMENT_SELECT });
    if (!payment || payment.orderId || (!payment.bookingId && !payment.reservationId)) return;
    if (!payment.storeId) return; // payments without a store can't be ledgered
    if (!PAYMENT_POSTABLE.includes(payment.status)) return;
    const amount = Number(payment.amount);
    if (!(amount > 0)) return;
    const accounts = await loadAccounts(payment.storeId);
    if (!accounts) return;
    const debitId = accounts.get(payment.provider === "CASH" ? "1000" : "1010")!;
    const revenueId = accounts.get(payment.reservationId ? "4200" : "4100")!;
    await createEntry(payment.storeId, PAY_REF(payment.id), payment.reservationId ? `Reservation payment ${payment.id}` : `Booking payment ${payment.id}`,
      entryDate ?? payment.verifiedAt ?? new Date(), [
        { accountId: debitId, debit: amount, credit: 0 },
        { accountId: revenueId, debit: 0, credit: amount },
      ]);
  } catch (err) {
    void logError("JOBS", "order-ledger: payment posting failed", errorMeta(err, { paymentId }));
  }
}

export async function postPaymentToLedgerByReference(reference: string): Promise<void> {
  const payment = await prisma.payment.findUnique({ where: { reference }, select: { id: true } }).catch(() => null);
  if (payment) await postPaymentToLedger(payment.id);
}

/** Reverses a refunded booking/reservation payment (posting the original first if it was never recorded). */
export async function postPaymentRefundToLedger(paymentId: string, entryDate?: Date): Promise<void> {
  try {
    const payment = await prisma.payment.findUnique({ where: { id: paymentId }, select: PAYMENT_SELECT });
    if (!payment || payment.orderId || (!payment.bookingId && !payment.reservationId)) return;
    if (!payment.storeId) return; // payments without a store can't be ledgered
    if (!(await loadAccounts(payment.storeId))) return;
    await postPaymentToLedger(payment.id, payment.verifiedAt ?? payment.createdAt);
    const original = await prisma.financialJournalEntry.findUnique({
      where: { storeId_reference: { storeId: payment.storeId, reference: PAY_REF(payment.id) } },
      select: { lines: { select: { accountId: true, debit: true, credit: true } } },
    });
    if (!original) return;
    await createEntry(payment.storeId, PAY_REFUND_REF(payment.id), `Refund: payment ${payment.id}`, entryDate ?? payment.refundedAt ?? new Date(),
      original.lines.map((l) => ({ accountId: l.accountId, debit: Number(l.credit), credit: Number(l.debit) })));
  } catch (err) {
    void logError("JOBS", "order-ledger: payment refund posting failed", errorMeta(err, { paymentId }));
  }
}

/**
 * Posts every paid/refunded order that has no ledger entry yet (dated at the
 * order's own date). Idempotent and capped per call, so it is safe to call
 * whenever the sale count and the posted-entry count disagree.
 */
export async function backfillOrderLedger(storeId: string, cap = 500): Promise<number> {
  try {
    if (!(await loadAccounts(storeId))) return 0;
    const posted = await prisma.financialJournalEntry.findMany({ where: { storeId, OR: [{ reference: { startsWith: "ORD-" } }, { reference: { startsWith: "PAY-" } }] }, select: { reference: true } });
    const done = new Set(posted.map((p) => p.reference));
    const orders = await prisma.order.findMany({
      where: { storeId, status: { in: [...LEDGER_SALE_STATUSES, "REFUNDED"] }, total: { gt: 0 } },
      orderBy: { createdAt: "asc" },
      select: { id: true, status: true, createdAt: true, updatedAt: true },
    });
    let n = 0;
    const payments = await prisma.payment.findMany({
      where: { storeId, orderId: null, OR: [{ bookingId: { not: null } }, { reservationId: { not: null } }], status: { in: ["SUCCESSFUL", "REFUNDED"] }, amount: { gt: 0 } },
      orderBy: { createdAt: "asc" },
      select: { id: true, status: true, verifiedAt: true, createdAt: true, refundedAt: true },
    });
    for (const pay of payments) {
      if (n >= cap) break;
      const needSale = !done.has(PAY_REF(pay.id));
      const needRefund = pay.status === "REFUNDED" && !done.has(PAY_REFUND_REF(pay.id));
      if (!needSale && !needRefund) continue;
      if (needSale) await postPaymentToLedger(pay.id, pay.verifiedAt ?? pay.createdAt);
      if (needRefund) await postPaymentRefundToLedger(pay.id, pay.refundedAt ?? new Date());
      n++;
    }
    for (const o of orders) {
      if (n >= cap) break;
      const needSale = !done.has(SALE_REF(o.id));
      const needRefund = o.status === "REFUNDED" && !done.has(REFUND_REF(o.id));
      if (!needSale && !needRefund) continue;
      if (needSale) await postOrderSaleToLedger(o.id, o.createdAt);
      if (needRefund) await postOrderRefundToLedger(o.id, o.updatedAt);
      n++;
    }
    return n;
  } catch (err) {
    void logError("JOBS", "order-ledger: backfill failed", errorMeta(err, { storeId }));
    return 0;
  }
}

/** Cheap check: do any paid/refunded orders still lack a sale entry? */
export async function ledgerNeedsBackfill(storeId: string): Promise<boolean> {
  const [orders, payments, entries] = await Promise.all([
    prisma.order.count({ where: { storeId, status: { in: [...LEDGER_SALE_STATUSES, "REFUNDED"] }, total: { gt: 0 } } }),
    prisma.payment.count({ where: { storeId, orderId: null, OR: [{ bookingId: { not: null } }, { reservationId: { not: null } }], status: { in: ["SUCCESSFUL", "REFUNDED"] }, amount: { gt: 0 } } }),
    prisma.financialJournalEntry.count({ where: { storeId, OR: [{ reference: { startsWith: "ORD-" } }, { reference: { startsWith: "PAY-" } }], NOT: [{ reference: { startsWith: "ORD-REF-" } }, { reference: { startsWith: "PAY-REF-" } }] } }),
  ]);
  return orders + payments > entries;
}