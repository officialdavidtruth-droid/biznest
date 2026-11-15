"use server";

import { prisma } from "@/lib/prisma";
import { financialAccess } from "@/lib/financial/access";
import type { ActionResult } from "@/types/actions";
import {
  buildBalanceSheet, buildCashFlow, buildProfitAndLoss, buildRatios, buildTrialBalance,
  type AccountType, type StmtAccount, type SumsById,
} from "@/lib/financial/statements";

const DAY = 86_400_000;
const startOfDayUtc = (s: string) => { const d = new Date(`${s.slice(0, 10)}T00:00:00.000Z`); return Number.isFinite(d.getTime()) ? d : null; };
const endOfDayUtc = (s: string) => { const d = new Date(`${s.slice(0, 10)}T23:59:59.999Z`); return Number.isFinite(d.getTime()) ? d : null; };

async function sumsFor(storeId: string, entryDate: { gte?: Date; lte?: Date; lt?: Date }, accountIds?: string[]): Promise<SumsById> {
  const rows = await prisma.financialJournalLine.groupBy({
    by: ["accountId"],
    where: { ...(accountIds ? { accountId: { in: accountIds } } : {}), journalEntry: { storeId, status: "POSTED", entryDate } },
    _sum: { debit: true, credit: true },
  });
  return new Map(rows.map((r) => [r.accountId, { debit: Number(r._sum.debit ?? 0), credit: Number(r._sum.credit ?? 0) }]));
}

/** Everything the Reports screen shows for one date range, computed from posted journal lines. */
export async function getFinancialStatements(slug: string, from: string, to: string) {
  const a = await financialAccess(slug);
  if (!a.success) return { success: false as const, error: a.error };
  const start = startOfDayUtc(from), end = endOfDayUtc(to);
  if (!start || !end || end < start) return { success: false as const, error: "Choose a valid date range." };
  if (end.getTime() - start.getTime() > 5 * 366 * DAY) return { success: false as const, error: "Choose a range of five years or less." };

  const span = end.getTime() - start.getTime() + 1;
  const priorEnd = new Date(start.getTime() - 1);
  const priorStart = new Date(start.getTime() - span);

  const rawAccounts = await prisma.financialAccount.findMany({ where: { storeId: a.store.id, isActive: true }, orderBy: { code: "asc" } });
  const accounts: StmtAccount[] = rawAccounts.map((x) => ({ id: x.id, code: x.code, name: x.name, type: x.type as AccountType }));
  const bankLinked = await prisma.financialBankAccount.findMany({ where: { storeId: a.store.id }, select: { financialAccountId: true } });
  const cashIds = new Set<string>([...accounts.filter((x) => x.code === "1000" || x.code === "1010").map((x) => x.id), ...bankLinked.map((b) => b.financialAccountId)]);

  const [current, prior, cumulative, openingCashSums, cashEntries, stock] = await Promise.all([
    sumsFor(a.store.id, { gte: start, lte: end }),
    sumsFor(a.store.id, { gte: priorStart, lte: priorEnd }),
    sumsFor(a.store.id, { lte: end }),
    sumsFor(a.store.id, { lt: start }, [...cashIds]),
    prisma.financialJournalEntry.findMany({
      where: { storeId: a.store.id, status: "POSTED", entryDate: { gte: start, lte: end }, lines: { some: { accountId: { in: [...cashIds] } } } },
      select: { lines: { select: { accountId: true, debit: true, credit: true } } },
      take: 5000,
    }),
    prisma.inventoryItem.findMany({ where: { storeId: a.store.id }, select: { quantity: true, costPrice: true }, take: 5000 }),
  ]);

  const pl = buildProfitAndLoss(accounts, current, prior);
  const bs = buildBalanceSheet(accounts, cumulative);
  const tb = buildTrialBalance(accounts, cumulative);
  const openingCash = [...openingCashSums.values()].reduce((s, x) => s + x.debit - x.credit, 0);
  const cf = buildCashFlow(accounts, cashIds, cashEntries.map((e) => ({ lines: e.lines.map((l) => ({ accountId: l.accountId, debit: Number(l.debit), credit: Number(l.credit) })) })), openingCash);
  const stockValue = stock.reduce((s, i) => s + i.quantity * Number(i.costPrice ?? 0), 0);
  const ratios = buildRatios(bs, pl, stockValue);

  return {
    success: true as const,
    data: {
      currency: a.store.currency, storeName: a.store.name,
      range: { from: start.toISOString(), to: end.toISOString(), priorFrom: priorStart.toISOString(), priorTo: priorEnd.toISOString() },
      pl, bs, tb, cf, ratios,
      entriesTruncated: cashEntries.length >= 5000,
    },
  };
}

export type FinancialStatements = Extract<Awaited<ReturnType<typeof getFinancialStatements>>, { success: true }>["data"];

export type StockRow = {
  id: string; name: string; sku: string | null; quantity: number; lowStockThreshold: number;
  costPrice: number | null; price: number; costValue: number; retailValue: number; marginPct: number | null; sold30d: number; status: "OK" | "LOW" | "OUT" | "NO_COST" | "SLOW";
};

/** Stock held, valued at cost and at selling price, and compared with the Inventory account in the ledger. */
export async function getStockValuation(slug: string): Promise<ActionResult<{
  rows: StockRow[];
  totals: { items: number; units: number; costValue: number; retailValue: number; potentialProfit: number };
  ledger: { accountId: string | null; balance: number; difference: number };
  flags: { out: number; low: number; noCost: number; slow: number };
  currency: string;
}>> {
  const a = await financialAccess(slug);
  if (!a.success) return { success: false, error: a.error };
  const since = new Date(Date.now() - 30 * DAY);
  const [items, moves, inventoryAccount] = await Promise.all([
    prisma.inventoryItem.findMany({ where: { storeId: a.store.id }, include: { product: { select: { name: true, price: true } } }, orderBy: { updatedAt: "desc" }, take: 2000 }),
    prisma.stockMovement.groupBy({ by: ["inventoryItemId"], where: { storeId: a.store.id, type: "SALE", inventoryItemId: { not: null }, createdAt: { gte: since } }, _sum: { quantityChange: true } }),
    prisma.financialAccount.findFirst({ where: { storeId: a.store.id, code: "1200" } }),
  ]);
  const sold = new Map(moves.map((m) => [m.inventoryItemId as string, Math.abs(m._sum.quantityChange ?? 0)]));
  const rows: StockRow[] = items.map((i) => {
    const cost = i.costPrice === null ? null : Number(i.costPrice);
    const price = Number(i.product.price);
    const sold30d = sold.get(i.id) ?? 0;
    const status: StockRow["status"] = i.quantity <= 0 ? "OUT" : cost === null ? "NO_COST" : i.quantity <= i.lowStockThreshold ? "LOW" : sold30d === 0 ? "SLOW" : "OK";
    return {
      id: i.id, name: i.product.name, sku: i.sku, quantity: i.quantity, lowStockThreshold: i.lowStockThreshold, costPrice: cost, price,
      costValue: Math.round(i.quantity * (cost ?? 0) * 100) / 100, retailValue: Math.round(i.quantity * price * 100) / 100,
      marginPct: cost !== null && price > 0 ? Math.round(((price - cost) / price) * 1000) / 10 : null, sold30d, status,
    };
  });
  const costValue = Math.round(rows.reduce((s, r) => s + r.costValue, 0) * 100) / 100;
  const retailValue = Math.round(rows.reduce((s, r) => s + r.retailValue, 0) * 100) / 100;
  let balance = 0;
  if (inventoryAccount) {
    const agg = await prisma.financialJournalLine.aggregate({ where: { accountId: inventoryAccount.id, journalEntry: { storeId: a.store.id, status: "POSTED" } }, _sum: { debit: true, credit: true } });
    balance = Math.round((Number(agg._sum.debit ?? 0) - Number(agg._sum.credit ?? 0)) * 100) / 100;
  }
  return {
    success: true,
    data: {
      rows,
      totals: { items: rows.length, units: rows.reduce((s, r) => s + Math.max(0, r.quantity), 0), costValue, retailValue, potentialProfit: Math.round((retailValue - costValue) * 100) / 100 },
      ledger: { accountId: inventoryAccount?.id ?? null, balance, difference: Math.round((costValue - balance) * 100) / 100 },
      flags: { out: rows.filter((r) => r.status === "OUT").length, low: rows.filter((r) => r.status === "LOW").length, noCost: rows.filter((r) => r.costPrice === null).length, slow: rows.filter((r) => r.status === "SLOW").length },
      currency: a.store.currency,
    },
  };
}

/**
 * Bring the Inventory account in the ledger in line with the stock valuation.
 * More stock than the ledger shows is treated as opening stock (equity); less is a write-down (cost of sales).
 */
export async function syncInventoryLedger(slug: string): Promise<ActionResult<{ amount: number; reference: string }>> {
  const a = await financialAccess(slug);
  if (!a.success) return { success: false, error: a.error };
  const valuation = await getStockValuation(slug);
  if (!valuation.success) return { success: false, error: valuation.error };
  const diff = valuation.data.ledger.difference;
  if (Math.abs(diff) < 0.01) return { success: false, error: "The ledger already matches the stock valuation." };
  const [inventory, equity, cogs] = await Promise.all(["1200", "3000", "5000"].map((code) => prisma.financialAccount.findFirst({ where: { storeId: a.store.id, code, isActive: true } })));
  if (!inventory || !equity || !cogs) return { success: false, error: "The Inventory, Owner Equity and Cost of Goods Sold accounts are needed." };
  const now = new Date();
  const period = await prisma.financialPeriod.findFirst({ where: { storeId: a.store.id, startsAt: { lte: now }, endsAt: { gte: now } } });
  if (period?.status === "CLOSED") return { success: false, error: "The current accounting period is closed." };
  const amount = Math.abs(diff);
  const reference = `JE-STOCK-${Date.now()}`;
  await prisma.financialJournalEntry.create({
    data: {
      storeId: a.store.id, periodId: period?.id, reference, entryDate: now, status: "POSTED", postedAt: now,
      description: diff > 0 ? "Stock valuation adjustment: opening stock brought into the ledger" : "Stock valuation adjustment: write-down to valuation",
      lines: { create: diff > 0
        ? [{ accountId: inventory.id, debit: amount, credit: 0 }, { accountId: equity.id, debit: 0, credit: amount }]
        : [{ accountId: cogs.id, debit: amount, credit: 0 }, { accountId: inventory.id, debit: 0, credit: amount }] },
    },
  });
  await prisma.auditLog.create({ data: { action: "FINANCIAL_STOCK_LEDGER_SYNCED", entity: "FinancialJournalEntry", entityId: reference, metadata: { storeId: a.store.id, amount, direction: diff > 0 ? "UP" : "DOWN" } } });
  return { success: true, data: { amount, reference } };
}
