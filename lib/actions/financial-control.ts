"use server";

import { prisma } from "@/lib/prisma";
import { auth } from "@/lib/auth";
import { assertStorePermission } from "@/lib/access/assert-store-access";
import { getPluginEntitlement } from "@/lib/plugins";
import { nanoid } from "nanoid";
import { revalidatePath } from "next/cache";
import type { ActionResult } from "@/types/actions";

async function access(slug: string) {
  const a = await assertStorePermission(slug, "plugin:financial-control");
  if (!a.success) return a;
  const entitlement = await getPluginEntitlement(a.store.id, "financial-control");
  if (!entitlement.allowed) return { success: false as const, error: entitlement.reason };
  if (!entitlement.installed) return { success: false as const, error: "Install Financial Control from Apps before opening this workspace." };
  return a;
}

const DEFAULT_ACCOUNTS = [
  ["1000", "Cash", "ASSET"],
  ["1010", "Bank", "ASSET"],
  ["1100", "Accounts Receivable", "ASSET"],
  ["1200", "Inventory", "ASSET"],
  ["1300", "Equipment", "ASSET"],
  ["2000", "Accounts Payable", "LIABILITY"],
  ["2100", "Tax Payable", "LIABILITY"],
  ["3000", "Owner Equity", "EQUITY"],
  ["4000", "Product Sales", "REVENUE"],
  ["4100", "Service Revenue", "REVENUE"],
  ["4200", "Room Revenue", "REVENUE"],
  ["5000", "Cost of Goods Sold", "EXPENSE"],
  ["6000", "Operating Expenses", "EXPENSE"],
  ["6100", "Salaries & Wages", "EXPENSE"],
  ["6200", "Rent & Utilities", "EXPENSE"],
  ["6300", "Marketing", "EXPENSE"],
] as const;

export async function ensureFinancialFoundation(storeId: string) {
  await prisma.financialAccount.createMany({
    data: DEFAULT_ACCOUNTS.map(([code, name, type]) => ({ storeId, code, name, type, isSystem: true })),
    skipDuplicates: true,
  });
  const now = new Date();
  const startsAt = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1));
  const endsAt = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() + 1, 0, 23, 59, 59, 999));
  await prisma.financialPeriod.upsert({
    where: { storeId_startsAt_endsAt: { storeId, startsAt, endsAt } },
    update: {},
    create: { storeId, name: startsAt.toLocaleString("en-NG", { month: "long", year: "numeric", timeZone: "UTC" }), startsAt, endsAt },
  });
}

export async function getFinancialControlData(slug: string) {
  const a = await access(slug);
  if (!a.success) return { error: a.error };
  await ensureFinancialFoundation(a.store.id);

  const [accounts, expenses, entries, periods, auditLogs, bankAccounts, bankTransactions, budgets, assets, invoices, purchaseOrders] = await Promise.all([
    prisma.financialAccount.findMany({ where: { storeId: a.store.id, isActive: true }, orderBy: { code: "asc" } }),
    prisma.financialExpense.findMany({ where: { storeId: a.store.id }, include: { expenseAccount: true, paymentAccount: true }, orderBy: { expenseDate: "desc" }, take: 20 }),
    prisma.financialJournalEntry.findMany({ where: { storeId: a.store.id, status: "POSTED" }, include: { lines: { include: { account: true } } }, orderBy: { entryDate: "desc" }, take: 100 }),
    prisma.financialPeriod.findMany({ where: { storeId: a.store.id }, orderBy: { startsAt: "desc" }, take: 12 }),
    prisma.auditLog.findMany({ where: { entity: { in: ["FinancialExpense", "FinancialJournalEntry", "FinancialPeriod", "FinancialBankAccount", "FinancialBankTransaction", "FinancialBudget", "FinancialAsset"] }, metadata: { path: ["storeId"], equals: a.store.id } }, orderBy: { createdAt: "desc" }, take: 50, select: { id: true, action: true, entity: true, entityId: true, createdAt: true, metadata: true } }),
    prisma.financialBankAccount.findMany({ where: { storeId: a.store.id, isActive: true }, include: { financialAccount: true }, orderBy: { name: "asc" } }),
    prisma.financialBankTransaction.findMany({ where: { storeId: a.store.id }, include: { bankAccount: true }, orderBy: { transactionDate: "desc" }, take: 50 }),
    prisma.financialBudget.findMany({ where: { storeId: a.store.id }, include: { lines: { include: { account: true } } }, orderBy: { startsAt: "desc" }, take: 12 }),
    prisma.financialAsset.findMany({ where: { storeId: a.store.id }, orderBy: { purchaseDate: "desc" }, take: 50 }),
    prisma.invoice.findMany({ where: { storeId: a.store.id, status: { in: ["SENT", "PAID"] } }, orderBy: { createdAt: "desc" }, take: 100, select: { id: true, invoiceNo: true, customerName: true, total: true, currency: true, status: true, createdAt: true, paidAt: true } }),
    prisma.purchaseOrder.findMany({ where: { storeId: a.store.id, status: { in: ["SENT", "PARTIALLY_RECEIVED", "RECEIVED"] } }, orderBy: { createdAt: "desc" }, take: 100, select: { id: true, poNumber: true, subtotal: true, currency: true, status: true, supplier: { select: { name: true } } } }),
  ]);

  const pendingRequisitionApprovals = await prisma.approvalRequest.findMany({
    where: { storeId: a.store.id, status: "PENDING", requestType: "REQUISITION", entityType: "Requisition" },
    orderBy: { createdAt: "asc" },
    take: 50,
    select: { id: true, entityId: true, title: true, requestedById: true, createdAt: true, note: true },
  });
  const pendingReqIds = pendingRequisitionApprovals.map((x) => x.entityId).filter(Boolean) as string[];
  const pendingReqs = pendingReqIds.length ? await prisma.requisition.findMany({ where: { storeId: a.store.id, id: { in: pendingReqIds } }, include: { items: true }, orderBy: { createdAt: "asc" } }) : [];
  const pendingReqMap = new Map(pendingReqs.map((r) => [r.id, r]));

  const balances = new Map<string, number>();
  for (const entry of entries) {
    for (const line of entry.lines) {
      balances.set(line.accountId, (balances.get(line.accountId) ?? 0) + Number(line.debit) - Number(line.credit));
    }
  }

  let revenue = 0;
  let expensesTotal = 0;
  let cash = 0;
  for (const account of accounts) {
    const signed = balances.get(account.id) ?? 0;
    if (account.type === "REVENUE") revenue += -signed;
    if (account.type === "EXPENSE") expensesTotal += signed;
    if (account.code === "1000" || account.code === "1010") cash += signed;
  }

  const now = new Date();
  const arAging = { current: 0, days31to60: 0, days61to90: 0, over90: 0 };
  for (const invoice of invoices) {
    if (invoice.status === "PAID") continue;
    const days = Math.max(0, Math.floor((now.getTime() - invoice.createdAt.getTime()) / 86400000));
    const amount = Number(invoice.total);
    if (days <= 30) arAging.current += amount;
    else if (days <= 60) arAging.days31to60 += amount;
    else if (days <= 90) arAging.days61to90 += amount;
    else arAging.over90 += amount;
  }
  const cashMovement30d = bankTransactions.filter(x => x.transactionDate >= new Date(now.getTime() - 30 * 86400000)).reduce((sum, x) => sum + Number(x.amount), 0);
  const unmatchedBankItems = bankTransactions.filter(x => x.status === "UNMATCHED").length;
  const expenseAccountActuals = new Map<string, number>();
  for (const entry of entries) for (const line of entry.lines) {
    if (line.account.type === "EXPENSE") expenseAccountActuals.set(line.accountId, (expenseAccountActuals.get(line.accountId) ?? 0) + Number(line.debit) - Number(line.credit));
  }
  const budgetVariance = budgets.flatMap(b => b.lines.map(l => ({ budgetId: b.id, budget: b.name, account: l.account.name, budgeted: Number(l.amount), actual: expenseAccountActuals.get(l.accountId) ?? 0, variance: Number(l.amount) - (expenseAccountActuals.get(l.accountId) ?? 0) })));

  return {
    store: { name: a.store.name, slug, businessType: a.store.businessType },
    accounts: accounts.map((x) => ({ id: x.id, code: x.code, name: x.name, type: x.type, balance: balances.get(x.id) ?? 0 })),
    expenses: expenses.map((x) => ({ id: x.id, expenseNo: x.expenseNo, description: x.description, vendorName: x.vendorName, amount: Number(x.amount), expenseDate: x.expenseDate.toISOString(), status: x.status, expenseAccount: x.expenseAccount.name, paymentAccount: x.paymentAccount.name })),
    entries: entries.map((x) => ({ id: x.id, reference: x.reference, description: x.description, entryDate: x.entryDate.toISOString(), lines: x.lines.map((l) => ({ account: l.account.name, debit: Number(l.debit), credit: Number(l.credit) })) })),
    periods: periods.map((x) => ({ id: x.id, name: x.name, startsAt: x.startsAt.toISOString(), endsAt: x.endsAt.toISOString(), status: x.status })),
    auditLogs: auditLogs.map((x) => ({ id: x.id, action: x.action, entity: x.entity, entityId: x.entityId, createdAt: x.createdAt.toISOString() })),
    bankAccounts: bankAccounts.map(x => ({ id: x.id, name: x.name, bankName: x.bankName, accountName: x.accountName, maskedNumber: x.maskedNumber, openingBalance: Number(x.openingBalance), accountId: x.financialAccountId, accountNameLedger: x.financialAccount.name })),
    bankTransactions: bankTransactions.map(x => ({ id: x.id, bankAccountId: x.bankAccountId, bankAccountName: x.bankAccount.name, transactionDate: x.transactionDate.toISOString(), description: x.description, amount: Number(x.amount), reference: x.reference, status: x.status })),
    budgets: budgets.map(x => ({ id: x.id, name: x.name, startsAt: x.startsAt.toISOString(), endsAt: x.endsAt.toISOString(), status: x.status, lines: x.lines.map(l => ({ accountId: l.accountId, account: l.account.name, amount: Number(l.amount) })) })),
    assets: assets.map(x => ({ id: x.id, assetNo: x.assetNo, name: x.name, category: x.category, purchaseDate: x.purchaseDate.toISOString(), purchaseCost: Number(x.purchaseCost), usefulLifeMonths: x.usefulLifeMonths, residualValue: Number(x.residualValue), accumulatedDepreciation: Number(x.accumulatedDepreciation), status: x.status })),
    receivables: invoices.map(x => ({ id: x.id, invoiceNo: x.invoiceNo, customerName: x.customerName, total: Number(x.total), currency: x.currency, status: x.status, createdAt: x.createdAt.toISOString(), paidAt: x.paidAt?.toISOString() ?? null })),
    payables: purchaseOrders.map(x => ({ id: x.id, poNumber: x.poNumber, supplierName: x.supplier.name, amount: Number(x.subtotal), currency: x.currency, status: x.status })),
    metrics: { revenue, expenses: expensesTotal, netProfit: revenue - expensesTotal, cash, receivables: invoices.filter(x => x.status !== "PAID").reduce((s,x)=>s+Number(x.total),0), payables: purchaseOrders.filter(x => x.status !== "RECEIVED").reduce((s,x)=>s+Number(x.subtotal),0) },
    management: { arAging, cashMovement30d, unmatchedBankItems, budgetVariance, pendingRequisitions: pendingRequisitionApprovals.map((a) => { const r = a.entityId ? pendingReqMap.get(a.entityId) : null; return r ? { approvalId: a.id, id: r.id, number: r.number, title: r.title, department: r.department, requesterName: r.requesterName, priority: r.priority, neededBy: r.neededBy?.toISOString() ?? null, notes: r.notes, totalEstimate: r.items.reduce((sum, i) => sum + Number(i.estimatedUnitCost ?? 0) * i.quantity, 0), createdAt: r.createdAt.toISOString() } : null; }).filter(Boolean) },
  };
}

export async function createFinancialExpense(
  slug: string,
  input: { description: string; vendorName?: string; amount: number; expenseDate: string; expenseAccountId: string; paymentAccountId: string; notes?: string }
): Promise<ActionResult<{ id: string; expenseNo: string }>> {
  const a = await access(slug);
  if (!a.success) return a;
  if (!Number.isFinite(input.amount) || input.amount <= 0) return { success: false, error: "Expense amount must be greater than zero." };
  const description = input.description.trim();
  if (!description) return { success: false, error: "Expense description is required." };
  const expenseDate = new Date(input.expenseDate);
  if (!Number.isFinite(expenseDate.getTime())) return { success: false, error: "Invalid expense date." };
  if (input.expenseAccountId === input.paymentAccountId) return { success: false, error: "Expense and payment accounts must be different." };

  const [expenseAccount, paymentAccount] = await Promise.all([
    prisma.financialAccount.findFirst({ where: { id: input.expenseAccountId, storeId: a.store.id, type: "EXPENSE", isActive: true } }),
    prisma.financialAccount.findFirst({ where: { id: input.paymentAccountId, storeId: a.store.id, type: { in: ["ASSET", "LIABILITY"] }, isActive: true } }),
  ]);
  if (!expenseAccount || !paymentAccount) return { success: false, error: "Select valid accounts belonging to this business." };

  const expenseNo = `BN-EXP-${Date.now()}-${nanoid(5).toUpperCase()}`;
  const row = await prisma.financialExpense.create({ data: { storeId: a.store.id, expenseNo, description, vendorName: input.vendorName?.trim() || null, amount: input.amount, expenseDate, expenseAccountId: expenseAccount.id, paymentAccountId: paymentAccount.id, notes: input.notes?.trim() || null, createdBy: a.role === "PLATFORM_STAFF" ? null : undefined } });
  revalidatePath(`/store/${slug}/admin/apps/financial-control`);
  return { success: true, data: { id: row.id, expenseNo } };
}

export async function approveAndPostExpense(slug: string, expenseId: string): Promise<ActionResult> {
  const a = await access(slug);
  if (!a.success) return a;

  const result = await prisma.$transaction(async (tx) => {
    const expense = await tx.financialExpense.findFirst({ where: { id: expenseId, storeId: a.store.id } });
    if (!expense) return { success: false as const, error: "Expense not found." };
    if (expense.status === "POSTED") return { success: true as const, already: true };
    if (expense.status === "REJECTED") return { success: false as const, error: "Rejected expenses cannot be posted." };

    const period = await tx.financialPeriod.findFirst({ where: { storeId: a.store.id, startsAt: { lte: expense.expenseDate }, endsAt: { gte: expense.expenseDate } } });
    if (period?.status === "CLOSED") return { success: false as const, error: "The accounting period for this expense is closed." };

    const reference = `JE-${expense.expenseNo}`;
    const entry = await tx.financialJournalEntry.create({
      data: {
        storeId: a.store.id,
        periodId: period?.id,
        reference,
        description: expense.description,
        entryDate: expense.expenseDate,
        status: "POSTED",
        postedAt: new Date(),
        postedBy: a.role === "PLATFORM_STAFF" ? null : undefined,
        createdBy: a.role === "PLATFORM_STAFF" ? null : undefined,
        lines: { create: [
          { accountId: expense.expenseAccountId, debit: expense.amount, credit: 0, description: expense.description },
          { accountId: expense.paymentAccountId, debit: 0, credit: expense.amount, description: expense.description },
        ] },
      },
    });
    await tx.financialExpense.update({ where: { id: expense.id }, data: { status: "POSTED", approvedAt: new Date(), approvedBy: a.role === "PLATFORM_STAFF" ? null : undefined, journalEntryId: entry.id } });
    return { success: true as const, already: false };
  });

  if (!result.success) return result;
  await prisma.auditLog.create({ data: { action: "FINANCIAL_EXPENSE_POSTED", entity: "FinancialExpense", entityId: expenseId, metadata: { storeId: a.store.id } } });
  revalidatePath(`/store/${slug}/admin/apps/financial-control`);
  return { success: true, data: undefined };
}

export async function createJournalEntry(
  slug: string,
  input: { description: string; entryDate: string; lines: Array<{ accountId: string; debit: number; credit: number; description?: string }> }
): Promise<ActionResult<{ reference: string }>> {
  const a = await access(slug);
  if (!a.success) return a;
  const description = input.description.trim();
  const entryDate = new Date(input.entryDate);
  if (!description || !Number.isFinite(entryDate.getTime())) return { success: false, error: "Description and a valid date are required." };
  if (input.lines.length < 2) return { success: false, error: "A journal needs at least two lines." };

  const cleanLines = input.lines.map((line) => ({ ...line, debit: Number(line.debit) || 0, credit: Number(line.credit) || 0 })).filter((line) => line.debit !== 0 || line.credit !== 0);
  if (cleanLines.length < 2 || cleanLines.some((line) => line.debit < 0 || line.credit < 0 || (line.debit > 0 && line.credit > 0))) return { success: false, error: "Each line must contain either a positive debit or a positive credit." };
  const debit = cleanLines.reduce((s, x) => s + x.debit, 0);
  const credit = cleanLines.reduce((s, x) => s + x.credit, 0);
  if (Math.abs(debit - credit) > 0.005) return { success: false, error: "Journal is not balanced. Total debits must equal total credits." };

  const accountIds = [...new Set(cleanLines.map((x) => x.accountId))];
  const accounts = await prisma.financialAccount.findMany({ where: { storeId: a.store.id, id: { in: accountIds }, isActive: true }, select: { id: true } });
  if (accounts.length !== accountIds.length) return { success: false, error: "One or more accounts do not belong to this business." };

  const period = await prisma.financialPeriod.findFirst({ where: { storeId: a.store.id, startsAt: { lte: entryDate }, endsAt: { gte: entryDate } } });
  if (period?.status === "CLOSED") return { success: false, error: "The accounting period is closed." };

  const reference = `JE-${Date.now()}-${nanoid(6).toUpperCase()}`;
  await prisma.financialJournalEntry.create({ data: { storeId: a.store.id, periodId: period?.id, reference, description, entryDate, status: "POSTED", postedAt: new Date(), lines: { create: cleanLines.map((line) => ({ accountId: line.accountId, debit: line.debit, credit: line.credit, description: line.description?.trim() || null })) } } });
  await prisma.auditLog.create({ data: { action: "FINANCIAL_JOURNAL_POSTED", entity: "FinancialJournalEntry", entityId: reference, metadata: { storeId: a.store.id, debit, credit } } });
  revalidatePath(`/store/${slug}/admin/apps/financial-control`);
  return { success: true, data: { reference } };
}

export async function createFinancialPeriod(slug: string, year: number, month: number): Promise<ActionResult<{ id: string }>> {
  const a = await access(slug);
  if (!a.success) return a;
  if (!Number.isInteger(year) || !Number.isInteger(month) || month < 1 || month > 12) return { success: false, error: "Invalid accounting period." };
  const startsAt = new Date(Date.UTC(year, month - 1, 1));
  const endsAt = new Date(Date.UTC(year, month, 0, 23, 59, 59, 999));
  const name = startsAt.toLocaleString("en-NG", { month: "long", year: "numeric", timeZone: "UTC" });
  const period = await prisma.financialPeriod.upsert({ where: { storeId_startsAt_endsAt: { storeId: a.store.id, startsAt, endsAt } }, update: {}, create: { storeId: a.store.id, name, startsAt, endsAt } });
  revalidatePath(`/store/${slug}/admin/apps/financial-control`);
  return { success: true, data: { id: period.id } };
}

export async function closeFinancialPeriod(slug: string, periodId: string): Promise<ActionResult> {
  const a = await access(slug);
  if (!a.success) return a;
  const period = await prisma.financialPeriod.findFirst({ where: { id: periodId, storeId: a.store.id } });
  if (!period) return { success: false, error: "Accounting period not found." };
  if (period.status === "CLOSED") return { success: true, data: undefined };
  await prisma.financialPeriod.update({ where: { id: period.id }, data: { status: "CLOSED", closedAt: new Date(), closedBy: a.role === "PLATFORM_STAFF" ? null : undefined } });
  await prisma.auditLog.create({ data: { action: "FINANCIAL_PERIOD_CLOSED", entity: "FinancialPeriod", entityId: period.id, metadata: { storeId: a.store.id } } });
  revalidatePath(`/store/${slug}/admin/apps/financial-control`);
  return { success: true, data: undefined };
}

export async function createFinancialBankAccount(slug: string, input: { name: string; bankName?: string; accountName?: string; maskedNumber?: string; financialAccountId: string; openingBalance?: number }): Promise<ActionResult<{ id: string }>> {
  const a = await access(slug); if (!a.success) return a;
  const name = input.name.trim();
  if (!name) return { success: false, error: "Bank account name is required." };
  const account = await prisma.financialAccount.findFirst({ where: { id: input.financialAccountId, storeId: a.store.id, type: "ASSET", isActive: true } });
  if (!account) return { success: false, error: "Select a valid asset account." };
  if (!Number.isFinite(input.openingBalance ?? 0)) return { success: false, error: "Invalid opening balance." };
  try {
    const row = await prisma.financialBankAccount.create({ data: { storeId: a.store.id, name, bankName: input.bankName?.trim() || null, accountName: input.accountName?.trim() || null, maskedNumber: input.maskedNumber?.trim() || null, financialAccountId: account.id, openingBalance: input.openingBalance ?? 0 } });
    await prisma.auditLog.create({ data: { action: "FINANCIAL_BANK_ACCOUNT_CREATED", entity: "FinancialBankAccount", entityId: row.id, metadata: { storeId: a.store.id } } });
    revalidatePath(`/store/${slug}/admin/apps/financial-control`);
    return { success: true, data: { id: row.id } };
  } catch (e: any) {
    if (e?.code === "P2002") return { success: false, error: "A bank account with that name already exists." };
    return { success: false, error: "Could not create bank account." };
  }
}

export async function addBankTransaction(slug: string, input: { bankAccountId: string; transactionDate: string; description: string; amount: number; reference?: string }): Promise<ActionResult<{ id: string }>> {
  const a = await access(slug); if (!a.success) return a;
  const date = new Date(input.transactionDate); const description = input.description.trim();
  if (!Number.isFinite(date.getTime()) || !description || !Number.isFinite(input.amount) || input.amount === 0) return { success: false, error: "Enter a valid date, description and non-zero amount." };
  const bank = await prisma.financialBankAccount.findFirst({ where: { id: input.bankAccountId, storeId: a.store.id, isActive: true } });
  if (!bank) return { success: false, error: "Bank account not found." };
  const row = await prisma.financialBankTransaction.create({ data: { storeId: a.store.id, bankAccountId: bank.id, transactionDate: date, description, amount: input.amount, reference: input.reference?.trim() || null } });
  revalidatePath(`/store/${slug}/admin/apps/financial-control`);
  return { success: true, data: { id: row.id } };
}

export async function reconcileBankTransaction(slug: string, transactionId: string, journalEntryId?: string): Promise<ActionResult> {
  const a = await access(slug); if (!a.success) return a;
  const tx = await prisma.financialBankTransaction.findFirst({ where: { id: transactionId, storeId: a.store.id }, include: { bankAccount: true } });
  if (!tx) return { success: false, error: "Bank transaction not found." };
  if (journalEntryId) {
    const entry = await prisma.financialJournalEntry.findFirst({ where: { id: journalEntryId, storeId: a.store.id, status: "POSTED" }, select: { id: true } });
    if (!entry) return { success: false, error: "Journal entry not found." };
  }
  await prisma.financialBankTransaction.update({ where: { id: tx.id }, data: { status: journalEntryId ? "MATCHED" : "IGNORED", matchedJournalEntryId: journalEntryId ?? null } });
  await prisma.auditLog.create({ data: { action: journalEntryId ? "BANK_TRANSACTION_MATCHED" : "BANK_TRANSACTION_IGNORED", entity: "FinancialBankTransaction", entityId: tx.id, metadata: { storeId: a.store.id, journalEntryId: journalEntryId ?? null } } });
  revalidatePath(`/store/${slug}/admin/apps/financial-control`);
  return { success: true, data: undefined };
}

export async function createFinancialBudget(slug: string, input: { name: string; startsAt: string; endsAt: string; lines: Array<{ accountId: string; amount: number }> }): Promise<ActionResult<{ id: string }>> {
  const a = await access(slug); if (!a.success) return a;
  const name = input.name.trim(); const startsAt = new Date(input.startsAt); const endsAt = new Date(input.endsAt);
  if (!name || !Number.isFinite(startsAt.getTime()) || !Number.isFinite(endsAt.getTime()) || endsAt < startsAt) return { success: false, error: "Enter a valid budget name and date range." };
  if (!input.lines.length || input.lines.some(l => !Number.isFinite(l.amount) || l.amount < 0)) return { success: false, error: "Add at least one valid budget line." };
  const ids = [...new Set(input.lines.map(l => l.accountId))];
  const accounts = await prisma.financialAccount.findMany({ where: { storeId: a.store.id, id: { in: ids }, isActive: true }, select: { id: true } });
  if (accounts.length !== ids.length) return { success: false, error: "One or more budget accounts are invalid." };
  try {
    const budget = await prisma.financialBudget.create({ data: { storeId: a.store.id, name, startsAt, endsAt, status: "ACTIVE", lines: { create: input.lines.map(l => ({ accountId: l.accountId, amount: l.amount })) } } });
    await prisma.auditLog.create({ data: { action: "FINANCIAL_BUDGET_CREATED", entity: "FinancialBudget", entityId: budget.id, metadata: { storeId: a.store.id } } });
    revalidatePath(`/store/${slug}/admin/apps/financial-control`);
    return { success: true, data: { id: budget.id } };
  } catch (e: any) {
    if (e?.code === "P2002") return { success: false, error: "A budget with that name already exists." };
    return { success: false, error: "Could not create budget." };
  }
}

export async function createFinancialAsset(slug: string, input: { name: string; category: string; purchaseDate: string; purchaseCost: number; usefulLifeMonths: number; residualValue?: number; notes?: string }): Promise<ActionResult<{ id: string; assetNo: string }>> {
  const a = await access(slug); if (!a.success) return a;
  const name = input.name.trim(); const category = input.category.trim(); const purchaseDate = new Date(input.purchaseDate);
  if (!name || !category || !Number.isFinite(purchaseDate.getTime()) || !Number.isFinite(input.purchaseCost) || input.purchaseCost <= 0 || !Number.isInteger(input.usefulLifeMonths) || input.usefulLifeMonths <= 0) return { success: false, error: "Enter valid asset details." };
  const residual = input.residualValue ?? 0;
  if (!Number.isFinite(residual) || residual < 0 || residual >= input.purchaseCost) return { success: false, error: "Residual value must be less than purchase cost." };
  const assetNo = `BN-AST-${Date.now()}-${nanoid(5).toUpperCase()}`;
  const asset = await prisma.financialAsset.create({ data: { storeId: a.store.id, assetNo, name, category, purchaseDate, purchaseCost: input.purchaseCost, usefulLifeMonths: input.usefulLifeMonths, residualValue: residual, notes: input.notes?.trim() || null } });
  await prisma.auditLog.create({ data: { action: "FINANCIAL_ASSET_CREATED", entity: "FinancialAsset", entityId: asset.id, metadata: { storeId: a.store.id } } });
  revalidatePath(`/store/${slug}/admin/apps/financial-control`);
  return { success: true, data: { id: asset.id, assetNo } };
}

export async function recordAssetDepreciation(slug: string, assetId: string, months = 1): Promise<ActionResult<{ amount: number }>> {
  const a = await access(slug); if (!a.success) return a;
  if (!Number.isInteger(months) || months <= 0 || months > 12) return { success: false, error: "Depreciation months must be between 1 and 12." };
  const asset = await prisma.financialAsset.findFirst({ where: { id: assetId, storeId: a.store.id, status: "ACTIVE" } });
  if (!asset) return { success: false, error: "Asset not found or inactive." };
  const remaining = Number(asset.purchaseCost) - Number(asset.residualValue) - Number(asset.accumulatedDepreciation);
  if (remaining <= 0) return { success: false, error: "This asset is fully depreciated." };
  const monthly = (Number(asset.purchaseCost) - Number(asset.residualValue)) / asset.usefulLifeMonths;
  const amount = Math.min(remaining, monthly * months);
  await prisma.financialAsset.update({ where: { id: asset.id }, data: { accumulatedDepreciation: { increment: amount }, status: Number(asset.accumulatedDepreciation) + amount >= Number(asset.purchaseCost) - Number(asset.residualValue) ? "FULLY_DEPRECIATED" : "ACTIVE" } });
  await prisma.auditLog.create({ data: { action: "FINANCIAL_ASSET_DEPRECIATED", entity: "FinancialAsset", entityId: asset.id, metadata: { storeId: a.store.id, amount, months } } });
  revalidatePath(`/store/${slug}/admin/apps/financial-control`);
  return { success: true, data: { amount } };
}

export async function decideFinancialRequisition(slug: string, requisitionId: string, decision: "APPROVED" | "REJECTED", note?: string): Promise<ActionResult> {
  const a = await access(slug);
  if (!a.success) return a;
  const session = await auth();
  const approval = await prisma.approvalRequest.findFirst({ where: { storeId: a.store.id, requestType: "REQUISITION", entityType: "Requisition", entityId: requisitionId, status: "PENDING" } });
  if (!approval) return { success: false, error: "This requisition is no longer awaiting financial approval." };
  const req = await prisma.requisition.findFirst({ where: { id: requisitionId, storeId: a.store.id } });
  if (!req) return { success: false, error: "Requisition not found." };
  if (req.status !== "SUBMITTED") return { success: false, error: "Only submitted requisitions can be decided." };
  await prisma.$transaction(async (tx) => {
    await tx.requisition.update({ where: { id: req.id }, data: { status: decision, decisionNote: note?.trim() || null, decidedAt: new Date() } });
    await tx.approvalRequest.update({ where: { id: approval.id }, data: { status: decision, approverId: session?.user?.id ?? null, note: note?.trim() || null, decidedAt: new Date() } });
    await tx.auditLog.create({ data: { action: decision === "APPROVED" ? "REQUISITION_FINANCIAL_APPROVED" : "REQUISITION_FINANCIAL_REJECTED", entity: "Requisition", entityId: req.id, metadata: { storeId: a.store.id, approvalId: approval.id, approverId: session?.user?.id ?? null } } });
  });
  revalidatePath(`/store/${slug}/admin/apps/financial-control`);
  revalidatePath(`/store/${slug}/admin/apps/requisition`);
  return { success: true, data: undefined };
}
