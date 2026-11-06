"use server";

import { revalidatePath } from "next/cache";
import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { assertStorePermission } from "@/lib/access/assert-store-access";
import { markJobChargePaid } from "@/lib/payments/job-receipt";
import { emailJobUpdate } from "@/lib/jobs-notify";
import {
  JOB_MIN_ONLINE_PAYMENT, JOB_PAYMENT_METHODS, firstStage, isNiche, isStage, itemsTotal, jobNumber, lastJobSeq, lastStage, money, newJobToken, safeHttpsUrl, sanitizeItem, sanitizeJobCard, splitCharges,
  type JobInput,
} from "@/lib/jobs";
import type { ActionResult } from "@/types/actions";

// Staff side of job cards. Every query is scoped to the caller's store.

const fail = (error: string): ActionResult<never> => ({ success: false, error });
const refresh = (slug: string) => revalidatePath(`/store/${slug}/admin/jobs`);
const access = (slug: string) => assertStorePermission(slug, "products");

async function ownedJob(storeId: string, jobId: string) {
  return prisma.jobCard.findFirst({ where: { id: jobId, storeId }, include: { items: true, charges: true } });
}

export async function createJobCard(slug: string, input: JobInput): Promise<ActionResult<{ id: string; jobNo: string }>> {
  const a = await access(slug); if (!a.success) return fail(a.error);
  const j = sanitizeJobCard(input); if (!j.ok) return fail(j.error);
  for (let attempt = 0; attempt < 5; attempt++) {
    const latest = await prisma.jobCard.findMany({ where: { storeId: a.store.id }, orderBy: { jobNo: "desc" }, take: 1, select: { jobNo: true } });
    const jobNo = jobNumber(lastJobSeq(latest.map((l) => l.jobNo)) + 1);
    try {
      const row = await prisma.jobCard.create({ data: { storeId: a.store.id, jobNo, ...j.job, stage: firstStage(j.job.niche), accessToken: newJobToken() }, select: { id: true } });
      refresh(slug);
      return { success: true, data: { id: row.id, jobNo } };
    } catch (err) {
      if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === "P2002") continue;
      throw err;
    }
  }
  return fail("Could not create the job. Please try again.");
}

export async function updateJobNotes(slug: string, jobId: string, input: { internalNotes?: string; deliverableUrl?: string }): Promise<ActionResult> {
  const a = await access(slug); if (!a.success) return fail(a.error);
  const data: Record<string, unknown> = {};
  if (input.internalNotes !== undefined) data.internalNotes = input.internalNotes.trim().slice(0, 2000) || null;
  if (input.deliverableUrl !== undefined) {
    const url = safeHttpsUrl(input.deliverableUrl);
    if (input.deliverableUrl.trim() && !url) return fail("The link must start with https://");
    data.deliverableUrl = url;
  }
  const res = await prisma.jobCard.updateMany({ where: { id: jobId, storeId: a.store.id }, data });
  if (res.count === 0) return fail("Job not found.");
  refresh(slug);
  return { success: true, data: undefined };
}

/** Editing the estimate after the customer approved it sends it back for approval, so they never pay for something they didn't agree to. */
async function reopenEstimate(jobId: string, status: string) {
  if (status === "APPROVED" || status === "DECLINED") await prisma.jobCard.update({ where: { id: jobId }, data: { estimateStatus: "NONE", estimateRespondedAt: null } });
}

export async function addJobItem(slug: string, jobId: string, input: { kind?: string; label: string; qty?: number; unitPrice: number }): Promise<ActionResult> {
  const a = await access(slug); if (!a.success) return fail(a.error);
  const job = await ownedJob(a.store.id, jobId); if (!job) return fail("Job not found.");
  if (job.status !== "OPEN") return fail("This job is closed.");
  const it = sanitizeItem(input); if (!it.ok) return fail(it.error);
  await prisma.jobCardItem.create({ data: { jobId: job.id, ...it.item } });
  await reopenEstimate(job.id, job.estimateStatus);
  refresh(slug);
  return { success: true, data: undefined };
}

export async function removeJobItem(slug: string, itemId: string): Promise<ActionResult> {
  const a = await access(slug); if (!a.success) return fail(a.error);
  const item = await prisma.jobCardItem.findFirst({ where: { id: itemId, job: { storeId: a.store.id, status: "OPEN" } }, select: { id: true, job: { select: { id: true, estimateStatus: true } } } });
  if (!item) return fail("Item not found.");
  await prisma.jobCardItem.delete({ where: { id: item.id } });
  await reopenEstimate(item.job.id, item.job.estimateStatus);
  refresh(slug);
  return { success: true, data: undefined };
}

/** Sends the estimate to the customer for approval. */
export async function requestEstimateApproval(slug: string, jobId: string): Promise<ActionResult> {
  const a = await access(slug); if (!a.success) return fail(a.error);
  const job = await ownedJob(a.store.id, jobId); if (!job) return fail("Job not found.");
  if (job.items.length === 0) return fail("Add at least one item to the estimate first.");
  await prisma.jobCard.update({ where: { id: job.id }, data: { estimateStatus: "PENDING", estimateRespondedAt: null } });
  await prisma.jobUpdate.create({ data: { jobId: job.id, message: "Estimate sent for your approval." } });
  void emailJobUpdate(job.id, "ESTIMATE");
  refresh(slug);
  return { success: true, data: undefined };
}

export async function setJobStage(slug: string, jobId: string, stage: string, message?: string, imageUrl?: string): Promise<ActionResult> {
  const a = await access(slug); if (!a.success) return fail(a.error);
  const job = await ownedJob(a.store.id, jobId); if (!job) return fail("Job not found.");
  if (!isNiche(job.niche) || !isStage(job.niche, stage)) return fail("Choose a valid stage.");
  if (job.status !== "OPEN") return fail("This job is closed.");
  const img = imageUrl?.trim() ? safeHttpsUrl(imageUrl) : null;
  if (imageUrl?.trim() && !img) return fail("The photo link must start with https://");
  const done = stage === lastStage(job.niche);
  await prisma.jobCard.update({ where: { id: job.id }, data: { stage, ...(done ? { status: "DONE", completedAt: new Date() } : {}) } });
  await prisma.jobUpdate.create({ data: { jobId: job.id, stage, message: message?.trim().slice(0, 500) || "", imageUrl: img } });
  void emailJobUpdate(job.id, "STAGE", message?.trim());
  refresh(slug);
  return { success: true, data: undefined };
}

export async function postJobUpdate(slug: string, jobId: string, message: string, imageUrl?: string): Promise<ActionResult> {
  const a = await access(slug); if (!a.success) return fail(a.error);
  const job = await ownedJob(a.store.id, jobId); if (!job) return fail("Job not found.");
  const text = message.trim().slice(0, 500);
  const img = imageUrl?.trim() ? safeHttpsUrl(imageUrl) : null;
  if (imageUrl?.trim() && !img) return fail("The photo link must start with https://");
  if (!text && !img) return fail("Write a message or add a photo link.");
  await prisma.jobUpdate.create({ data: { jobId: job.id, message: text, imageUrl: img } });
  void emailJobUpdate(job.id, "NOTE", text);
  refresh(slug);
  return { success: true, data: undefined };
}

export async function cancelJobCard(slug: string, jobId: string): Promise<ActionResult> {
  const a = await access(slug); if (!a.success) return fail(a.error);
  const res = await prisma.jobCard.updateMany({ where: { id: jobId, storeId: a.store.id, status: "OPEN" }, data: { status: "CANCELLED" } });
  if (res.count === 0) return fail("Only open jobs can be cancelled.");
  await prisma.jobCharge.updateMany({ where: { jobId, storeId: a.store.id, status: "DUE" }, data: { status: "VOID" } });
  refresh(slug);
  return { success: true, data: undefined };
}

/** Bills the job from its items: one charge, or a deposit plus balance. Won't bill more than the estimate total. */
export async function billJob(slug: string, jobId: string, depositPct: number): Promise<ActionResult<{ created: number }>> {
  const a = await access(slug); if (!a.success) return fail(a.error);
  const job = await ownedJob(a.store.id, jobId); if (!job) return fail("Job not found.");
  if (job.status === "CANCELLED") return fail("This job was cancelled.");
  const total = itemsTotal(job.items.map((i) => ({ qty: i.qty, unitPrice: Number(i.unitPrice) })));
  if (!(total > 0)) return fail("Add priced items first.");
  if (job.estimateStatus === "PENDING" || job.estimateStatus === "DECLINED") return fail(job.estimateStatus === "PENDING" ? "Wait for the customer to approve the estimate, or change it." : "The customer declined this estimate.");
  const billed = job.charges.filter((c) => c.status !== "VOID").reduce((s, c) => s + Number(c.amount), 0);
  const remaining = Math.round((total - billed) * 100) / 100;
  if (!(remaining > 0)) return fail("This job is already fully billed.");
  const plan = billed === 0 ? splitCharges(total, depositPct) : [{ label: "Balance", amount: remaining }];
  if (plan.some((p) => p.amount < JOB_MIN_ONLINE_PAYMENT)) return fail(`Each charge must be at least ${JOB_MIN_ONLINE_PAYMENT}. Use a smaller deposit percentage or none.`);
  await prisma.jobCharge.createMany({ data: plan.map((p) => ({ storeId: a.store.id, jobId: job.id, label: p.label, amount: p.amount })) });
  refresh(slug);
  return { success: true, data: { created: plan.length } };
}

export async function addJobCharge(slug: string, jobId: string, input: { label: string; amount: number }): Promise<ActionResult> {
  const a = await access(slug); if (!a.success) return fail(a.error);
  const job = await ownedJob(a.store.id, jobId); if (!job) return fail("Job not found.");
  const label = input.label.replace(/\s+/g, " ").trim().slice(0, 120);
  if (!label) return fail("Name the charge.");
  const amount = money(input.amount);
  if (!Number.isFinite(amount) || amount <= 0) return fail("Enter an amount greater than zero.");
  await prisma.jobCharge.create({ data: { storeId: a.store.id, jobId: job.id, label, amount } });
  refresh(slug);
  return { success: true, data: undefined };
}

export async function recordJobPayment(slug: string, chargeId: string, input: { method: string; reference?: string; note?: string }): Promise<ActionResult<{ receiptNo: string }>> {
  const a = await access(slug); if (!a.success) return fail(a.error);
  if (!(JOB_PAYMENT_METHODS as readonly string[]).includes(input.method)) return fail("Choose how it was paid.");
  const charge = await prisma.jobCharge.findFirst({ where: { id: chargeId, storeId: a.store.id } });
  if (!charge) return fail("Charge not found.");
  if (charge.status !== "DUE") return fail(charge.status === "PAID" ? "This is already paid." : "This was cancelled.");
  const receiptNo = await prisma.$transaction((tx) => markJobChargePaid(tx, { chargeId: charge.id, storeId: a.store.id, method: input.method, reference: input.reference?.trim().slice(0, 80) || null, note: input.note?.trim().slice(0, 300) || null }));
  if (!receiptNo) return fail("This was just paid or cancelled. Refresh and check.");
  refresh(slug);
  return { success: true, data: { receiptNo } };
}

export async function voidJobCharge(slug: string, chargeId: string): Promise<ActionResult> {
  const a = await access(slug); if (!a.success) return fail(a.error);
  const res = await prisma.jobCharge.updateMany({ where: { id: chargeId, storeId: a.store.id, status: "DUE" }, data: { status: "VOID" } });
  if (res.count === 0) return fail("Only unpaid charges can be cancelled.");
  refresh(slug);
  return { success: true, data: undefined };
}
