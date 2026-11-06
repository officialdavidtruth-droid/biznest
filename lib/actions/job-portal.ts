"use server";

import { headers } from "next/headers";
import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { checkRateLimit, getClientIp } from "@/lib/rate-limit";
import { notifyUser } from "@/lib/notifications/notify";
import { startJobCharge } from "@/lib/payments/job-charge";
import { jobPagePath } from "@/lib/jobs";
import type { ActionResult } from "@/types/actions";

// Public (no sign-in) entry points for customers, authorised by the job's unguessable link.

async function callerIp() {
  try { return getClientIp(await headers()); } catch { return "unknown"; }
}
const validToken = (t: unknown): t is string => typeof t === "string" && /^[A-Za-z0-9_-]{20,40}$/.test(t);
const storeSelect = { id: true, slug: true, name: true, status: true, customDomain: true, customDomainStatus: true, business: { select: { user: { select: { id: true } } } } } as const;

async function customerJob(slug: string, token: string) {
  if (!validToken(token)) return null;
  const store = await prisma.store.findUnique({ where: { slug }, select: storeSelect });
  if (!store || store.status !== "ACTIVE") return null;
  const job = await prisma.jobCard.findUnique({ where: { accessToken: token } });
  if (!job || job.storeId !== store.id || job.status === "CANCELLED") return null;
  return { store, job };
}

export async function startJobPayment(slug: string, token: string, chargeId: string): Promise<ActionResult<{ url: string }>> {
  if (!validToken(token)) return { success: false, error: "This link isn't valid." };
  const ip = await callerIp();
  const [byIp, byToken] = await Promise.all([checkRateLimit(`job-pay:ip:${ip}`, 20, 60 * 60 * 1000), checkRateLimit(`job-pay:tok:${token}`, 10, 60 * 60 * 1000)]);
  if (!byIp.allowed || !byToken.allowed) return { success: false, error: "Too many attempts. Please try again in a little while." };
  const ctx = await customerJob(slug, token);
  if (!ctx) return { success: false, error: "This link isn't valid." };
  const charge = await prisma.jobCharge.findFirst({ where: { id: chargeId, jobId: ctx.job.id, storeId: ctx.store.id } });
  if (!charge) return { success: false, error: "Charge not found." };
  if (charge.status !== "DUE") return { success: false, error: charge.status === "PAID" ? "This is already paid." : "This was cancelled." };
  const r = await startJobCharge({ store: ctx.store, chargeId: charge.id, amount: Number(charge.amount), customerName: ctx.job.customerName, customerEmail: ctx.job.customerEmail });
  if (!r.success) return { success: false, error: r.error };
  return { success: true, data: { url: r.url } };
}

/** The customer approves or declines the estimate. Only a PENDING estimate can be answered, once. */
export async function respondToEstimate(slug: string, token: string, approve: boolean): Promise<ActionResult> {
  const ip = await callerIp();
  const lim = await checkRateLimit(`job-est:ip:${ip}`, 20, 60 * 60 * 1000);
  if (!lim.allowed) return { success: false, error: "Too many attempts. Please try again in a little while." };
  const ctx = await customerJob(slug, token);
  if (!ctx) return { success: false, error: "This link isn't valid." };
  const res = await prisma.jobCard.updateMany({ where: { id: ctx.job.id, estimateStatus: "PENDING" }, data: { estimateStatus: approve ? "APPROVED" : "DECLINED", estimateRespondedAt: new Date() } });
  if (res.count === 0) return { success: false, error: "This estimate has already been answered or changed." };
  await prisma.jobUpdate.create({ data: { jobId: ctx.job.id, message: approve ? "Customer approved the estimate." : "Customer declined the estimate." } });
  const ownerId = ctx.store.business?.user?.id;
  if (ownerId) {
    await notifyUser({ userId: ownerId, type: "JOB_ESTIMATE", title: `${approve ? "Estimate approved" : "Estimate declined"}: ${ctx.job.jobNo}`, body: `${ctx.job.customerName} ${approve ? "approved" : "declined"} the estimate for ${ctx.job.title}.`, url: `/store/${slug}/admin/jobs` }).catch(() => null);
  }
  revalidatePath(jobPagePath(slug, token)); revalidatePath(`/store/${slug}/admin/jobs`);
  return { success: true, data: undefined };
}
