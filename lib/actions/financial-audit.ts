"use server";

import { prisma } from "@/lib/prisma";
import { financialAccess } from "@/lib/financial/access";
import { adjustStock } from "@/lib/actions/inventory";
import { lineVariance, summariseCount, SEVERITIES, AUDIT_TYPES } from "@/lib/financial/audit-math";
import type { ActionResult } from "@/types/actions";
import { nanoid } from "nanoid";
import { auth } from "@/lib/auth";

type AuditType = (typeof AUDIT_TYPES)[number];
const num = (d: unknown) => (d === null || d === undefined ? null : Number(d));

type LineView = { id: string; subjectType: string; subjectId: string | null; label: string; sku: string | null; expectedQty: number; countedQty: number | null; unitCost: number; note: string | null; countedAt: string | null };
type FindingView = { id: string; title: string; detail: string | null; severity: string; status: string; recommendation: string | null; response: string | null; createdAt: string };
export type AuditView = {
  id: string; auditNo: string; title: string; type: AuditType; status: string; auditorName: string | null; scope: string | null; conclusion: string | null;
  varianceValue: number; journalPosted: boolean; startedAt: string; signedOffAt: string | null;
  lines: LineView[]; findings: FindingView[]; summary: ReturnType<typeof summariseCount>;
};

function view(a: any): AuditView {
  const lines: LineView[] = (a.lines ?? []).map((l: any) => ({
    id: l.id, subjectType: l.subjectType as string, subjectId: l.subjectId as string | null, label: l.label as string, sku: l.sku as string | null,
    expectedQty: Number(l.expectedQty), countedQty: num(l.countedQty), unitCost: Number(l.unitCost), note: l.note as string | null, countedAt: l.countedAt ? (l.countedAt as Date).toISOString() : null,
  }));
  return {
    id: a.id as string, auditNo: a.auditNo as string, title: a.title as string, type: a.type as AuditType, status: a.status as string,
    auditorName: a.auditorName as string | null, scope: a.scope as string | null, conclusion: a.conclusion as string | null,
    varianceValue: Number(a.varianceValue), journalPosted: a.journalPosted as boolean,
    startedAt: (a.startedAt as Date).toISOString(), signedOffAt: a.signedOffAt ? (a.signedOffAt as Date).toISOString() : null,
    lines,
    findings: ((a.findings ?? []) as any[]).map((f: any): FindingView => ({
      id: f.id as string, title: f.title as string, detail: f.detail as string | null, severity: f.severity as string, status: f.status as string,
      recommendation: f.recommendation as string | null, response: f.response as string | null, createdAt: (f.createdAt as Date).toISOString(),
    })),
    summary: summariseCount(lines.map((l) => ({ expectedQty: l.expectedQty, countedQty: l.countedQty, unitCost: l.unitCost }))),
  };
}

export async function listFinancialAudits(slug: string): Promise<ActionResult<AuditView[]>> {
  const a = await financialAccess(slug);
  if (!a.success) return { success: false, error: a.error };
  const rows = await prisma.financialAudit.findMany({ where: { storeId: a.store.id }, include: { lines: true, findings: { orderBy: { createdAt: "desc" } } }, orderBy: { createdAt: "desc" }, take: 40 });
  return { success: true, data: rows.map(view) };
}

async function owned(slug: string, auditId: string) {
  const a = await financialAccess(slug);
  if (!a.success) return { ok: false as const, error: a.error };
  const audit = await prisma.financialAudit.findFirst({ where: { id: auditId, storeId: a.store.id } });
  if (!audit) return { ok: false as const, error: "Audit not found." };
  return { ok: true as const, a, audit };
}

/** Start an audit. The system figures are frozen as the "expected" column so later sales don't move the goalposts. */
export async function createFinancialAudit(slug: string, input: { title: string; type: AuditType; auditorName?: string; scope?: string }): Promise<ActionResult<{ id: string }>> {
  const a = await financialAccess(slug);
  if (!a.success) return { success: false, error: a.error };
  const title = input.title.trim().slice(0, 120);
  if (!title) return { success: false, error: "Give the audit a title." };
  if (!AUDIT_TYPES.includes(input.type)) return { success: false, error: "Choose what you are auditing." };

  let lines: { subjectType: string; subjectId: string | null; label: string; sku: string | null; expectedQty: number; unitCost: number }[] = [];
  if (input.type === "STOCK") {
    const items = await prisma.inventoryItem.findMany({ where: { storeId: a.store.id }, include: { product: { select: { name: true } } }, orderBy: { product: { name: "asc" } }, take: 2000 });
    lines = items.map((i) => ({ subjectType: "STOCK_ITEM", subjectId: i.id, label: i.product.name, sku: i.sku, expectedQty: i.quantity, unitCost: Number(i.costPrice ?? 0) }));
    if (!lines.length) return { success: false, error: "There is no stock to count yet." };
  } else if (input.type === "CASH") {
    const accounts = await prisma.financialAccount.findMany({ where: { storeId: a.store.id, isActive: true, OR: [{ code: { in: ["1000", "1010"] } }, { bankAccounts: { some: {} } }] } });
    for (const acc of accounts) {
      const agg = await prisma.financialJournalLine.aggregate({ where: { accountId: acc.id, journalEntry: { storeId: a.store.id, status: "POSTED" } }, _sum: { debit: true, credit: true } });
      lines.push({ subjectType: "CASH_ACCOUNT", subjectId: acc.id, label: acc.name, sku: acc.code, expectedQty: Math.round((Number(agg._sum.debit ?? 0) - Number(agg._sum.credit ?? 0)) * 100) / 100, unitCost: 1 });
    }
  } else if (input.type === "ASSETS") {
    const assets = await prisma.financialAsset.findMany({ where: { storeId: a.store.id, status: "ACTIVE" }, take: 500 });
    lines = assets.map((x) => ({ subjectType: "ASSET", subjectId: x.id, label: x.name, sku: x.assetNo, expectedQty: 1, unitCost: Math.max(0, Number(x.purchaseCost) - Number(x.accumulatedDepreciation)) }));
    if (!lines.length) return { success: false, error: "No active fixed assets to verify. Add assets first." };
  }

  const count = await prisma.financialAudit.count({ where: { storeId: a.store.id } });
  const auditNo = `AUD-${String(count + 1).padStart(4, "0")}-${nanoid(3).toUpperCase()}`;
  const row = await prisma.financialAudit.create({
    data: {
      storeId: a.store.id, auditNo, title, type: input.type, auditorName: input.auditorName?.trim().slice(0, 80) || null, scope: input.scope?.trim() || null,
      lines: { create: lines.map((l) => ({ ...l, expectedQty: l.expectedQty, unitCost: l.unitCost })) },
    },
  });
  await prisma.auditLog.create({ data: { action: "FINANCIAL_AUDIT_STARTED", entity: "FinancialAudit", entityId: auditNo, metadata: { storeId: a.store.id, type: input.type, lines: lines.length } } });
  return { success: true, data: { id: row.id } };
}

export async function recordAuditCount(slug: string, auditId: string, lineId: string, countedQty: number | null, note?: string): Promise<ActionResult> {
  const o = await owned(slug, auditId);
  if (!o.ok) return { success: false, error: o.error };
  if (o.audit.status === "SIGNED_OFF") return { success: false, error: "This audit is signed off and can't be changed." };
  if (countedQty !== null && (!Number.isFinite(countedQty) || countedQty < 0)) return { success: false, error: "Enter a count of zero or more." };
  const res = await prisma.financialAuditLine.updateMany({
    where: { id: lineId, auditId },
    data: { countedQty, countedAt: countedQty === null ? null : new Date(), ...(note !== undefined ? { note: note.trim().slice(0, 500) || null } : {}) },
  });
  return res.count ? { success: true, data: undefined } : { success: false, error: "Line not found." };
}

export async function addAuditFinding(slug: string, auditId: string, input: { title: string; detail?: string; severity: string; recommendation?: string }): Promise<ActionResult<{ id: string }>> {
  const o = await owned(slug, auditId);
  if (!o.ok) return { success: false, error: o.error };
  if (o.audit.status === "SIGNED_OFF") return { success: false, error: "This audit is signed off and can't be changed." };
  const title = input.title.trim().slice(0, 160);
  if (!title) return { success: false, error: "Describe the finding." };
  const severity = (SEVERITIES as readonly string[]).includes(input.severity) ? input.severity : "MEDIUM";
  const row = await prisma.financialAuditFinding.create({ data: { auditId, title, severity, detail: input.detail?.trim() || null, recommendation: input.recommendation?.trim() || null } });
  return { success: true, data: { id: row.id } };
}

/** Management replies to a finding, or the auditor closes it. */
export async function updateAuditFinding(slug: string, auditId: string, findingId: string, patch: { status?: string; response?: string }): Promise<ActionResult> {
  const o = await owned(slug, auditId);
  if (!o.ok) return { success: false, error: o.error };
  const data: { status?: string; response?: string | null } = {};
  if (patch.status && ["OPEN", "ACTIONED", "CLOSED"].includes(patch.status)) data.status = patch.status;
  if (patch.response !== undefined) data.response = patch.response.trim().slice(0, 2000) || null;
  const res = await prisma.financialAuditFinding.updateMany({ where: { id: findingId, auditId }, data });
  return res.count ? { success: true, data: undefined } : { success: false, error: "Finding not found." };
}

export async function submitAuditForReview(slug: string, auditId: string): Promise<ActionResult> {
  const o = await owned(slug, auditId);
  if (!o.ok) return { success: false, error: o.error };
  if (o.audit.status === "SIGNED_OFF") return { success: false, error: "Already signed off." };
  const lines = await prisma.financialAuditLine.findMany({ where: { auditId } });
  const sum = summariseCount(lines.map((l) => ({ expectedQty: Number(l.expectedQty), countedQty: num(l.countedQty), unitCost: Number(l.unitCost) })));
  if (lines.length && sum.remaining > 0) return { success: false, error: `${sum.remaining} line${sum.remaining === 1 ? " is" : "s are"} not counted yet.` };
  await prisma.financialAudit.update({ where: { id: auditId }, data: { status: "UNDER_REVIEW", varianceValue: sum.netVariance } });
  return { success: true, data: undefined };
}

export async function reopenAudit(slug: string, auditId: string): Promise<ActionResult> {
  const o = await owned(slug, auditId);
  if (!o.ok) return { success: false, error: o.error };
  if (o.audit.status !== "UNDER_REVIEW") return { success: false, error: "Only an audit under review can be sent back." };
  await prisma.financialAudit.update({ where: { id: auditId }, data: { status: "IN_PROGRESS" } });
  return { success: true, data: undefined };
}

export async function signOffAudit(slug: string, auditId: string, conclusion: string): Promise<ActionResult> {
  const o = await owned(slug, auditId);
  if (!o.ok) return { success: false, error: o.error };
  if (o.audit.status === "SIGNED_OFF") return { success: false, error: "Already signed off." };
  const text = conclusion.trim();
  if (text.length < 10) return { success: false, error: "Write the auditor's conclusion before signing off." };
  const session = await auth();
  const [lines, openCritical] = await Promise.all([
    prisma.financialAuditLine.findMany({ where: { auditId } }),
    prisma.financialAuditFinding.count({ where: { auditId, severity: "CRITICAL", status: "OPEN" } }),
  ]);
  const sum = summariseCount(lines.map((l) => ({ expectedQty: Number(l.expectedQty), countedQty: num(l.countedQty), unitCost: Number(l.unitCost) })));
  if (lines.length && sum.remaining > 0) return { success: false, error: `${sum.remaining} line${sum.remaining === 1 ? " is" : "s are"} not counted yet.` };
  if (openCritical > 0) return { success: false, error: "Resolve or action the open critical findings before signing off." };
  await prisma.financialAudit.update({ where: { id: auditId }, data: { status: "SIGNED_OFF", conclusion: text.slice(0, 4000), signedOffAt: new Date(), completedAt: new Date(), signedOffBy: session?.user?.name || session?.user?.email || (o.a.role === "PLATFORM_STAFF" ? "Platform staff" : o.a.store.name), varianceValue: sum.netVariance } });
  await prisma.auditLog.create({ data: { action: "FINANCIAL_AUDIT_SIGNED_OFF", entity: "FinancialAudit", entityId: o.audit.auditNo, metadata: { storeId: o.a.store.id, netVariance: sum.netVariance } } });
  return { success: true, data: undefined };
}

/**
 * Book the audit's stock or cash variance into the ledger (shrinkage / cash short), and for stock
 * optionally correct the quantities on hand so the shop matches what was counted.
 */
export async function postAuditVariance(slug: string, auditId: string, options: { correctStock: boolean }): Promise<ActionResult<{ reference: string; amount: number }>> {
  const o = await owned(slug, auditId);
  if (!o.ok) return { success: false, error: o.error };
  const { a, audit } = o;
  if (audit.status !== "SIGNED_OFF") return { success: false, error: "Sign the audit off before posting its variance." };
  if (audit.journalPosted) return { success: false, error: "The variance has already been posted." };
  if (audit.type !== "STOCK" && audit.type !== "CASH") return { success: false, error: "Only stock and cash audits can be posted to the ledger." };

  const lines = await prisma.financialAuditLine.findMany({ where: { auditId } });
  const withVar = lines.map((l) => ({ l, v: lineVariance({ expectedQty: Number(l.expectedQty), countedQty: num(l.countedQty), unitCost: Number(l.unitCost) }) })).filter((x) => x.v.value !== 0);
  if (!withVar.length) return { success: false, error: "There is no variance to post." };

  const now = new Date();
  const period = await prisma.financialPeriod.findFirst({ where: { storeId: a.store.id, startsAt: { lte: now }, endsAt: { gte: now } } });
  if (period?.status === "CLOSED") return { success: false, error: "The current accounting period is closed." };

  const codes = audit.type === "STOCK" ? ["1200", "5000"] : ["6000"];
  const accounts = await prisma.financialAccount.findMany({ where: { storeId: a.store.id, code: { in: codes }, isActive: true } });
  const byCode = new Map(accounts.map((x) => [x.code, x]));
  if (codes.some((c) => !byCode.has(c))) return { success: false, error: "The accounts needed to book this variance are missing." };

  const jl: { accountId: string; debit: number; credit: number; description: string }[] = [];
  let total = 0;
  if (audit.type === "STOCK") {
    const net = withVar.reduce((s, x) => s + x.v.value, 0);
    if (Math.abs(net) < 0.01) return { success: false, error: "Shortages and surpluses cancel out; nothing to post." };
    total = Math.abs(net);
    jl.push(net > 0
      ? { accountId: byCode.get("5000")!.id, debit: total, credit: 0, description: "Stock shortage" }
      : { accountId: byCode.get("1200")!.id, debit: total, credit: 0, description: "Stock surplus" });
    jl.push(net > 0
      ? { accountId: byCode.get("1200")!.id, debit: 0, credit: total, description: "Stock shortage" }
      : { accountId: byCode.get("5000")!.id, debit: 0, credit: total, description: "Stock surplus" });
  } else {
    for (const { l, v } of withVar) {
      if (!l.subjectId) continue;
      const amt = Math.abs(v.value);
      total += v.value;
      jl.push(v.value > 0
        ? { accountId: byCode.get("6000")!.id, debit: amt, credit: 0, description: `Cash short: ${l.label}` }
        : { accountId: l.subjectId, debit: amt, credit: 0, description: `Cash over: ${l.label}` });
      jl.push(v.value > 0
        ? { accountId: l.subjectId, debit: 0, credit: amt, description: `Cash short: ${l.label}` }
        : { accountId: byCode.get("6000")!.id, debit: 0, credit: amt, description: `Cash over: ${l.label}` });
    }
    total = Math.abs(total);
  }
  if (jl.length < 2) return { success: false, error: "Nothing to post." };

  const reference = `JE-${audit.auditNo}`;
  await prisma.$transaction([
    prisma.financialJournalEntry.create({ data: { storeId: a.store.id, periodId: period?.id, reference, entryDate: now, status: "POSTED", postedAt: now, description: `Audit variance: ${audit.title}`, lines: { create: jl } } }),
    prisma.financialAudit.update({ where: { id: auditId }, data: { journalPosted: true } }),
  ]);

  let corrected = 0, failed = 0;
  if (audit.type === "STOCK" && options.correctStock) {
    for (const { l, v } of withVar) {
      if (!l.subjectId || !Number.isInteger(v.qty)) { failed++; continue; }
      const res = await adjustStock(slug, l.subjectId, -v.qty, "CORRECTION", `Audit ${audit.auditNo}`);
      if (res.success) corrected++; else failed++;
    }
  }
  await prisma.auditLog.create({ data: { action: "FINANCIAL_AUDIT_VARIANCE_POSTED", entity: "FinancialAudit", entityId: audit.auditNo, metadata: { storeId: a.store.id, amount: total, corrected, failed } } });
  return { success: true, data: { reference, amount: total } };
}

export async function deleteFinancialAudit(slug: string, auditId: string): Promise<ActionResult> {
  const o = await owned(slug, auditId);
  if (!o.ok) return { success: false, error: o.error };
  if (o.audit.status === "SIGNED_OFF") return { success: false, error: "Signed-off audits are kept as a record and can't be deleted." };
  await prisma.financialAudit.delete({ where: { id: auditId } });
  return { success: true, data: undefined };
}
