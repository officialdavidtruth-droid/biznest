import { describe, expect, it } from "vitest";
import { buildBalanceSheet, buildCashFlow, buildProfitAndLoss, buildRatios, buildTrialBalance, toCsv, type StmtAccount, type SumsById } from "../statements";

const A = (id: string, code: string, name: string, type: StmtAccount["type"]): StmtAccount => ({ id, code, name, type });
const accounts = [
  A("cash", "1000", "Cash", "ASSET"), A("bank", "1010", "Bank", "ASSET"), A("inv", "1200", "Inventory", "ASSET"), A("eq", "1300", "Equipment", "ASSET"),
  A("ap", "2000", "Accounts Payable", "LIABILITY"), A("own", "3000", "Owner Equity", "EQUITY"),
  A("sales", "4000", "Product Sales", "REVENUE"), A("cogs", "5000", "Cost of Goods Sold", "EXPENSE"), A("rent", "6200", "Rent", "EXPENSE"),
];
const sums = (o: Record<string, [number, number]>): SumsById => new Map(Object.entries(o).map(([k, [debit, credit]]) => [k, { debit, credit }]));

describe("profit and loss", () => {
  const pl = buildProfitAndLoss(accounts, sums({ sales: [0, 1000], cogs: [400, 0], rent: [150, 0] }), sums({ sales: [0, 800], cogs: [300, 0] }));
  it("splits gross and net profit", () => {
    expect(pl.totals).toEqual({ revenue: 1000, costOfSales: 400, grossProfit: 600, expenses: 150, netProfit: 450 });
  });
  it("keeps the prior period for comparison", () => {
    expect(pl.prior.netProfit).toBe(500);
    expect(pl.revenue[0].prior).toBe(800);
  });
  it("computes margins and survives zero revenue", () => {
    expect(pl.margins.gross).toBe(60);
    expect(pl.margins.net).toBe(45);
    expect(buildProfitAndLoss(accounts, new Map(), new Map()).margins).toEqual({ gross: 0, net: 0, expenseRatio: 0 });
  });
});

describe("balance sheet and trial balance", () => {
  // Owner puts in 2000 cash; buys stock 500 on credit; sells for 1000 cash, cost 400; pays rent 150.
  const cum = sums({ cash: [3000, 150], inv: [500, 400], ap: [0, 500], own: [0, 2000], sales: [0, 1000], cogs: [400, 0], rent: [150, 0] });
  it("balances once current earnings are included", () => {
    const bs = buildBalanceSheet(accounts, cum);
    expect(bs.currentEarnings).toBe(450);
    expect(bs.totals.assets).toBe(2950);
    expect(bs.totals.liabilitiesAndEquity).toBe(2950);
    expect(bs.balanced).toBe(true);
  });
  it("flags an unbalanced ledger", () => {
    expect(buildBalanceSheet(accounts, sums({ cash: [100, 0] })).balanced).toBe(false);
  });
  it("trial balance debits equal credits", () => {
    const tb = buildTrialBalance(accounts, cum);
    expect(tb.balanced).toBe(true);
    expect(tb.totals.debit).toBe(tb.totals.credit);
  });
});

describe("cash flow", () => {
  const ids = new Set(["cash", "bank"]);
  const entries = [
    { lines: [{ accountId: "bank", debit: 2000, credit: 0 }, { accountId: "own", debit: 0, credit: 2000 }] },
    { lines: [{ accountId: "cash", debit: 1000, credit: 0 }, { accountId: "sales", debit: 0, credit: 1000 }] },
    { lines: [{ accountId: "rent", debit: 150, credit: 0 }, { accountId: "bank", debit: 0, credit: 150 }] },
    { lines: [{ accountId: "eq", debit: 700, credit: 0 }, { accountId: "bank", debit: 0, credit: 700 }] },
    { lines: [{ accountId: "cash", debit: 50, credit: 0 }, { accountId: "bank", debit: 0, credit: 50 }] }, // transfer: no effect
    { lines: [{ accountId: "inv", debit: 10, credit: 0 }, { accountId: "ap", debit: 0, credit: 10 }] }, // no cash
  ];
  const cf = buildCashFlow(accounts, ids, entries, 100);
  it("files each movement under the right heading", () => {
    expect(cf.totals).toEqual({ operating: 850, investing: -700, financing: 2000, net: 2150 });
  });
  it("rolls opening to closing cash", () => {
    expect(cf.closingCash).toBe(2250);
  });
});

describe("ratios and csv", () => {
  it("returns null rather than dividing by zero", () => {
    const bs = buildBalanceSheet(accounts, new Map());
    const pl = buildProfitAndLoss(accounts, new Map(), new Map());
    expect(buildRatios(bs, pl, 0)).toMatchObject({ currentRatio: null, stockTurnover: null, daysOfStock: null });
  });
  it("quotes csv cells that need it", () => {
    expect(toCsv([["a,b", 'say "hi"', 3]])).toBe('﻿"a,b","say ""hi""",3');
  });
});
