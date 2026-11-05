import "server-only";
import { prisma } from "@/lib/prisma";
import { commissionFor, tripMoney } from "@/lib/travel";
import { agingBucket, profitOf, AGING_BUCKETS, type AgingBucket } from "@/lib/travel-growth";
import { toCsv } from "@/lib/utils/csv";

export type ProfitTrip = {
  id: string; reference: string; title: string; destination: string; client: string; agent: string | null; status: string; currency: string;
  departDate: string | null; price: number; cost: number; commission: number; profit: number; marginPct: number | null; paid: number; balance: number;
};
export type Receivable = {
  paymentId: string; tripId: string; reference: string; client: string; phone: string | null; email: string | null; currency: string;
  amount: number; dueDate: string | null; bucket: AgingBucket; daysOverdue: number;
};
export type CurrencyTotals = { currency: string; price: number; cost: number; commission: number; profit: number; paid: number; balance: number; trips: number };

const r2 = (n: number) => Math.round(n * 100) / 100;
const REPORT_STATUSES = ["CONFIRMED", "TICKETED", "TRAVELLING", "COMPLETED"];

/**
 * Profit per trip and instalments owed, for one store. Profit is the selling price less supplier cost and the agent
 * commission earned so far. Totals are kept per currency because adding naira to dollars would be meaningless.
 */
export async function buildTravelReports(storeId: string, now = new Date()) {
  const [trips, dues] = await Promise.all([
    prisma.travelTrip.findMany({
      where: { storeId, status: { in: REPORT_STATUSES } }, orderBy: { createdAt: "desc" }, take: 2000,
      include: { client: { select: { fullName: true } }, agent: { select: { name: true } }, payments: true },
    }),
    prisma.travelPayment.findMany({
      where: { status: "DUE", trip: { storeId, status: { notIn: ["CANCELLED", "COMPLETED"] } } }, orderBy: { dueDate: "asc" }, take: 2000,
      include: { trip: { select: { id: true, reference: true, currency: true, client: { select: { fullName: true, phone: true, email: true } } } } },
    }),
  ]);

  const rows: ProfitTrip[] = trips.map((t) => {
    const m = tripMoney(t, t.payments);
    const commission = commissionFor(t, t.payments, Number(t.commissionRate), t.commissionBasis).earned;
    const p = profitOf({ price: m.total, cost: m.cost, commission, paid: m.paid });
    return {
      id: t.id, reference: t.reference, title: t.title, destination: t.destination, client: t.client.fullName, agent: t.agent?.name ?? null, status: t.status, currency: t.currency,
      departDate: t.departDate?.toISOString() ?? null, price: m.total, cost: m.cost, commission, profit: p.profit, marginPct: p.marginPct, paid: m.paid, balance: m.balance,
    };
  });

  const totals = new Map<string, CurrencyTotals>();
  for (const r of rows) {
    const t = totals.get(r.currency) ?? { currency: r.currency, price: 0, cost: 0, commission: 0, profit: 0, paid: 0, balance: 0, trips: 0 };
    t.price = r2(t.price + r.price); t.cost = r2(t.cost + r.cost); t.commission = r2(t.commission + r.commission); t.profit = r2(t.profit + r.profit);
    t.paid = r2(t.paid + r.paid); t.balance = r2(t.balance + r.balance); t.trips += 1;
    totals.set(r.currency, t);
  }

  const receivables: Receivable[] = dues.map((d) => {
    const bucket = agingBucket(d.dueDate, now);
    return {
      paymentId: d.id, tripId: d.trip.id, reference: d.trip.reference, client: d.trip.client.fullName, phone: d.trip.client.phone, email: d.trip.client.email,
      currency: d.trip.currency, amount: Number(d.amount), dueDate: d.dueDate?.toISOString() ?? null, bucket,
      daysOverdue: d.dueDate ? Math.max(0, Math.floor((now.getTime() - d.dueDate.getTime()) / 86_400_000)) : 0,
    };
  });
  const aging = AGING_BUCKETS.map((bucket) => {
    const inBucket = receivables.filter((r) => r.bucket === bucket);
    const byCurrency = new Map<string, number>();
    for (const r of inBucket) byCurrency.set(r.currency, r2((byCurrency.get(r.currency) ?? 0) + r.amount));
    return { bucket, count: inBucket.length, amounts: [...byCurrency].map(([currency, amount]) => ({ currency, amount })) };
  });

  const dest = new Map<string, { destination: string; currency: string; trips: number; price: number; profit: number }>();
  for (const r of rows) {
    const key = `${r.destination.trim().toLowerCase()}|${r.currency}`;
    const d = dest.get(key) ?? { destination: r.destination.trim(), currency: r.currency, trips: 0, price: 0, profit: 0 };
    d.trips += 1; d.price = r2(d.price + r.price); d.profit = r2(d.profit + r.profit);
    dest.set(key, d);
  }

  return { rows, totals: [...totals.values()], receivables, aging, byDestination: [...dest.values()].sort((a, b) => b.profit - a.profit).slice(0, 15) };
}

export type TravelReports = Awaited<ReturnType<typeof buildTravelReports>>;

export function profitCsv(r: TravelReports): string {
  return toCsv(
    ["Reference", "Client", "Title", "Destination", "Agent", "Status", "Departure", "Currency", "Price", "Supplier cost", "Agent commission", "Profit", "Margin %", "Paid", "Balance"],
    r.rows.map((x) => [x.reference, x.client, x.title, x.destination, x.agent, x.status, x.departDate?.slice(0, 10), x.currency, x.price, x.cost, x.commission, x.profit, x.marginPct, x.paid, x.balance]),
  );
}

export function receivablesCsv(r: TravelReports): string {
  return toCsv(
    ["Reference", "Client", "Phone", "Email", "Currency", "Amount due", "Due date", "Days overdue", "Ageing"],
    r.receivables.map((x) => [x.reference, x.client, x.phone, x.email, x.currency, x.amount, x.dueDate?.slice(0, 10), x.daysOverdue, x.bucket]),
  );
}

/** Payments received, one line per payment, for the accountant. Includes refunds as their own column. */
export async function paymentsCsv(storeId: string): Promise<string> {
  const pays = await prisma.travelPayment.findMany({
    where: { status: { in: ["RECEIVED", "REFUNDED"] }, trip: { storeId } }, orderBy: { paidAt: "desc" }, take: 5000,
    include: { trip: { select: { reference: true, title: true, currency: true, client: { select: { fullName: true } } } } },
  });
  return toCsv(
    ["Date", "Trip reference", "Client", "Trip", "Currency", "Amount", "Refunded", "Net", "Method", "Reference"],
    pays.map((p) => [p.paidAt?.toISOString().slice(0, 10) ?? "", p.trip.reference, p.trip.client.fullName, p.trip.title, p.trip.currency, Number(p.amount), Number(p.refundedAmount), r2(Number(p.amount) - Number(p.refundedAmount)), p.method, p.reference]),
  );
}
