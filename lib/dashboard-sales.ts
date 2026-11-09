import "server-only";
import { prisma } from "@/lib/prisma";
import { PLUGIN_SALE_PURPOSES, type PluginSale, type PluginSalePurpose } from "@/lib/dashboard-sales-types";

export { PLUGIN_SALE_LABEL, PLUGIN_SALE_PURPOSES, type PluginSale, type PluginSalePurpose } from "@/lib/dashboard-sales-types";

// Travel keeps its own client-payment ledger (online payments are copied into it), so it is read from there.
const FROM_PAYMENT_TABLE = PLUGIN_SALE_PURPOSES.filter((p) => p !== "TRAVEL_BOOKING");


function inRange(from: Date, to: Date) {
  // A payment counts on the day it was confirmed; older rows without that stamp fall back to creation time.
  return [{ verifiedAt: { gte: from, lt: to } }, { verifiedAt: null, createdAt: { gte: from, lt: to } }];
}

export async function loadPluginSales(storeId: string, from: Date, to: Date, take = 2000): Promise<PluginSale[]> {
  const range = { gte: from, lt: to };
  const [paid, rent, members, jobs, tickets, travel] = await Promise.all([
    prisma.payment.findMany({
      where: { storeId, status: "SUCCESSFUL", purpose: { in: [...FROM_PAYMENT_TABLE] }, OR: inRange(from, to) },
      select: { id: true, amount: true, verifiedAt: true, createdAt: true, purpose: true, reference: true },
      orderBy: { createdAt: "desc" },
      take,
    }),
    // Money staff marked as received in person (cash, transfer) is saved on the record itself with no Payment row.
    // Anything paid online or approved through a Payment is excluded here so it is never counted twice.
    prisma.rentCharge.findMany({ where: { storeId, status: "PAID", paidAt: range, payments: { none: {} } }, select: { id: true, amount: true, paidAt: true, receiptNo: true }, take }),
    prisma.memberCharge.findMany({ where: { storeId, status: "PAID", paidAt: range, payments: { none: {} } }, select: { id: true, amount: true, paidAt: true, receiptNo: true }, take }),
    prisma.jobCharge.findMany({ where: { storeId, status: "PAID", paidAt: range, payments: { none: {} } }, select: { id: true, amount: true, paidAt: true, receiptNo: true }, take }),
    prisma.ticketOrder.findMany({ where: { storeId, status: "PAID", paidAt: range, payments: { none: {} } }, select: { id: true, total: true, paidAt: true, receiptNo: true }, take }),
    prisma.travelPayment.findMany({ where: { trip: { storeId }, status: "RECEIVED", paidAt: range }, select: { id: true, amount: true, paidAt: true, reference: true }, take }),
  ]);
  const out: PluginSale[] = paid.map((r) => ({ id: r.id, amount: Number(r.amount), at: r.verifiedAt ?? r.createdAt, purpose: r.purpose as PluginSalePurpose, reference: r.reference }));
  const add = (rows: Array<{ id: string; paidAt: Date | null; receiptNo?: string | null; reference?: string | null; amount?: unknown; total?: unknown }>, purpose: PluginSalePurpose) => {
    for (const r of rows) if (r.paidAt) out.push({ id: `${purpose}:${r.id}`, amount: Number(r.amount ?? r.total ?? 0), at: r.paidAt, purpose, reference: r.receiptNo ?? r.reference ?? r.id });
  };
  add(rent, "RENT_PAYMENT"); add(members, "MEMBER_PAYMENT"); add(jobs, "JOB_PAYMENT"); add(tickets, "TICKET_PURCHASE"); add(travel, "TRAVEL_BOOKING");
  return out.filter((r) => r.amount > 0).sort((a, b) => b.at.getTime() - a.at.getTime());
}
