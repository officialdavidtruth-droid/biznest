/**
 * Financial statements built from posted journal lines. Everything here is pure
 * (no database), so the same maths can be tested and reused by the screens,
 * the CSV export and the spreadsheet importer.
 */

export type AccountType = "ASSET" | "LIABILITY" | "EQUITY" | "REVENUE" | "EXPENSE";
export type StmtAccount = { id: string; code: string; name: string; type: AccountType };
export type Sums = { debit: number; credit: number };
export type SumsById = Map<string, Sums>;

const round = (n: number) => Math.round((n + Number.EPSILON) * 100) / 100;
const net = (s?: Sums) => (s ? s.debit - s.credit : 0);

export type PlRow = { id: string; code: string; name: string; amount: number; prior: number };
export type ProfitAndLoss = {
  revenue: PlRow[];
  costOfSales: PlRow[];
  expenses: PlRow[];
  totals: { revenue: number; costOfSales: number; grossProfit: number; expenses: number; netProfit: number };
  prior: { revenue: number; costOfSales: number; grossProfit: number; expenses: number; netProfit: number };
  margins: { gross: number; net: number; expenseRatio: number };
};

/** Cost of sales = expense accounts in the 5xxx range (COGS); everything else is an operating expense. */
export const isCostOfSales = (a: StmtAccount) => a.type === "EXPENSE" && a.code.startsWith("5");

export function buildProfitAndLoss(accounts: StmtAccount[], current: SumsById, prior: SumsById): ProfitAndLoss {
  const rows = (filter: (a: StmtAccount) => boolean, sign: 1 | -1): PlRow[] =>
    accounts
      .filter(filter)
      .map((a) => ({ id: a.id, code: a.code, name: a.name, amount: round(sign * net(current.get(a.id))), prior: round(sign * net(prior.get(a.id))) }))
      .filter((r) => r.amount !== 0 || r.prior !== 0)
      .sort((x, y) => x.code.localeCompare(y.code));
  const revenue = rows((a) => a.type === "REVENUE", -1);
  const costOfSales = rows(isCostOfSales, 1);
  const expenses = rows((a) => a.type === "EXPENSE" && !isCostOfSales(a), 1);
  const sum = (r: PlRow[], k: "amount" | "prior") => round(r.reduce((s, x) => s + x[k], 0));
  const t = (k: "amount" | "prior") => {
    const rev = sum(revenue, k), cos = sum(costOfSales, k), exp = sum(expenses, k);
    return { revenue: rev, costOfSales: cos, grossProfit: round(rev - cos), expenses: exp, netProfit: round(rev - cos - exp) };
  };
  const totals = t("amount");
  const pct = (a: number, b: number) => (b ? round((a / b) * 100) : 0);
  return {
    revenue, costOfSales, expenses, totals, prior: t("prior"),
    margins: { gross: pct(totals.grossProfit, totals.revenue), net: pct(totals.netProfit, totals.revenue), expenseRatio: pct(totals.expenses, totals.revenue) },
  };
}

export type BsRow = { id: string; code: string; name: string; amount: number };
export type BalanceSheet = {
  assets: BsRow[]; liabilities: BsRow[]; equity: BsRow[];
  currentEarnings: number;
  totals: { assets: number; liabilities: number; equity: number; liabilitiesAndEquity: number };
  difference: number; balanced: boolean;
};

/** `cumulative` = everything posted up to and including the "as at" date. */
export function buildBalanceSheet(accounts: StmtAccount[], cumulative: SumsById): BalanceSheet {
  const rows = (type: AccountType, sign: 1 | -1): BsRow[] =>
    accounts.filter((a) => a.type === type)
      .map((a) => ({ id: a.id, code: a.code, name: a.name, amount: round(sign * net(cumulative.get(a.id))) }))
      .filter((r) => r.amount !== 0)
      .sort((x, y) => x.code.localeCompare(y.code));
  const assets = rows("ASSET", 1), liabilities = rows("LIABILITY", -1), equity = rows("EQUITY", -1);
  // Profit not yet closed into equity: all revenue less all expenses to date.
  const currentEarnings = round(
    accounts.filter((a) => a.type === "REVENUE").reduce((s, a) => s - net(cumulative.get(a.id)), 0) -
    accounts.filter((a) => a.type === "EXPENSE").reduce((s, a) => s + net(cumulative.get(a.id)), 0),
  );
  const sum = (r: BsRow[]) => round(r.reduce((s, x) => s + x.amount, 0));
  const totals = { assets: sum(assets), liabilities: sum(liabilities), equity: round(sum(equity) + currentEarnings), liabilitiesAndEquity: 0 };
  totals.liabilitiesAndEquity = round(totals.liabilities + totals.equity);
  const difference = round(totals.assets - totals.liabilitiesAndEquity);
  return { assets, liabilities, equity, currentEarnings, totals, difference, balanced: Math.abs(difference) < 0.01 };
}

export type TbRow = { id: string; code: string; name: string; type: AccountType; debit: number; credit: number };
export function buildTrialBalance(accounts: StmtAccount[], cumulative: SumsById) {
  const rows: TbRow[] = accounts
    .map((a) => {
      const n = round(net(cumulative.get(a.id)));
      return { id: a.id, code: a.code, name: a.name, type: a.type, debit: n > 0 ? n : 0, credit: n < 0 ? -n : 0 };
    })
    .filter((r) => r.debit !== 0 || r.credit !== 0)
    .sort((x, y) => x.code.localeCompare(y.code));
  const debit = round(rows.reduce((s, r) => s + r.debit, 0));
  const credit = round(rows.reduce((s, r) => s + r.credit, 0));
  return { rows, totals: { debit, credit }, balanced: Math.abs(debit - credit) < 0.01 };
}

export type CashEntry = { lines: { accountId: string; debit: number; credit: number }[] };
export type CashFlowRow = { name: string; amount: number };
export type CashFlow = {
  operating: CashFlowRow[]; investing: CashFlowRow[]; financing: CashFlowRow[];
  totals: { operating: number; investing: number; financing: number; net: number };
  openingCash: number; closingCash: number;
};

/**
 * Direct-method cash flow. For each journal entry that touches cash, the cash
 * effect of every non-cash line is the opposite of its debit-minus-credit, and
 * is filed by what that line was for: equipment (13xx) is investing, equity is
 * financing, everything else is operating.
 */
export function buildCashFlow(accounts: StmtAccount[], cashAccountIds: Set<string>, entries: CashEntry[], openingCash: number): CashFlow {
  const byId = new Map(accounts.map((a) => [a.id, a]));
  const buckets = { operating: new Map<string, number>(), investing: new Map<string, number>(), financing: new Map<string, number>() };
  for (const e of entries) {
    if (!e.lines.some((l) => cashAccountIds.has(l.accountId))) continue;
    for (const l of e.lines) {
      if (cashAccountIds.has(l.accountId)) continue;
      const acc = byId.get(l.accountId);
      if (!acc) continue;
      const effect = -(l.debit - l.credit);
      const bucket = acc.type === "EQUITY" ? buckets.financing : acc.type === "ASSET" && acc.code.startsWith("13") ? buckets.investing : buckets.operating;
      bucket.set(acc.name, (bucket.get(acc.name) ?? 0) + effect);
    }
  }
  const toRows = (m: Map<string, number>): CashFlowRow[] =>
    [...m].map(([name, amount]) => ({ name, amount: round(amount) })).filter((r) => r.amount !== 0).sort((a, b) => Math.abs(b.amount) - Math.abs(a.amount));
  const operating = toRows(buckets.operating), investing = toRows(buckets.investing), financing = toRows(buckets.financing);
  const sum = (r: CashFlowRow[]) => round(r.reduce((s, x) => s + x.amount, 0));
  const totals = { operating: sum(operating), investing: sum(investing), financing: sum(financing), net: 0 };
  totals.net = round(totals.operating + totals.investing + totals.financing);
  return { operating, investing, financing, totals, openingCash: round(openingCash), closingCash: round(openingCash + totals.net) };
}

/** Simple ratios a business owner actually uses. Zero denominators give null, not Infinity. */
export function buildRatios(bs: BalanceSheet, pl: ProfitAndLoss, stockValue: number) {
  const find = (rows: BsRow[], code: string) => rows.find((r) => r.code === code)?.amount ?? 0;
  const currentAssets = round(find(bs.assets, "1000") + find(bs.assets, "1010") + find(bs.assets, "1100") + find(bs.assets, "1200"));
  const currentLiabilities = round(bs.liabilities.reduce((s, r) => s + r.amount, 0));
  const ratio = (a: number, b: number) => (b ? round(a / b) : null);
  return {
    currentRatio: ratio(currentAssets, currentLiabilities),
    quickRatio: ratio(currentAssets - find(bs.assets, "1200"), currentLiabilities),
    stockTurnover: ratio(pl.totals.costOfSales, stockValue),
    daysOfStock: pl.totals.costOfSales ? Math.round((stockValue / pl.totals.costOfSales) * 365) : null,
    netMarginPct: pl.margins.net,
    grossMarginPct: pl.margins.gross,
  };
}

/** Turn any table into a CSV string that Excel opens correctly. */
export function toCsv(rows: (string | number | null)[][]): string {
  const cell = (v: string | number | null) => {
    const s = v === null || v === undefined ? "" : String(v);
    return /[",\n\r]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
  };
  return "﻿" + rows.map((r) => r.map(cell).join(",")).join("\r\n");
}
