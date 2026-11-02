"use server";

import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { assertAnyStorePermission } from "@/lib/access/assert-store-access";
import { getPluginEntitlement } from "@/lib/plugins";
import { logStoreActivity } from "@/lib/activity-log";
import { RECRUIT_STAGES, JOB_STATUSES, EMPLOYMENT_TYPES } from "@/lib/recruitment-constants";
import type { ActionResult } from "@/types/actions";

const PLUGIN_KEY = "recruitment-ats";
const PERMISSIONS = ["plugin:recruitment-ats"] as const;

async function access(slug: string) {
  const a = await assertAnyStorePermission(slug, [...PERMISSIONS]);
  if (!a.success) return { ok: false as const, error: a.error };
  const e = await getPluginEntitlement(a.store.id, PLUGIN_KEY);
  if (!e.allowed) return { ok: false as const, error: e.reason };
  if (!e.installed) return { ok: false as const, error: "Install Recruitment to use this workspace." };
  return { ok: true as const, store: a.store };
}

const text = (form: FormData, key: string) => String(form.get(key) || "").trim();
const optMoney = (form: FormData, key: string) => {
  const raw = text(form, key);
  if (!raw) return null;
  const n = Number(raw);
  return Number.isFinite(n) && n >= 0 ? n : NaN;
};
const money = (v: unknown) => (v == null ? null : Number(v));

async function log(storeId: string, action: string, target: string) {
  const s = await auth();
  await logStoreActivity({ storeId, actor: { id: s?.user?.id, name: s?.user?.name, email: s?.user?.email, role: s?.user?.role ?? "OWNER" }, action, target });
}

export async function getRecruitmentDashboard(slug: string) {
  const a = await access(slug);
  if (!a.ok) return { error: a.error };
  const storeId = a.store.id;

  const [jobRows, candidateRows, applicationRows] = await Promise.all([
    prisma.recruitJob.findMany({ where: { storeId }, orderBy: { createdAt: "desc" }, take: 200 }),
    prisma.recruitCandidate.findMany({ where: { storeId }, orderBy: [{ lastName: "asc" }, { firstName: "asc" }], take: 500 }),
    prisma.recruitApplication.findMany({
      where: { storeId },
      orderBy: { stageChangedAt: "desc" },
      take: 1000,
      include: {
        job: { select: { id: true, title: true, clientName: true } },
        candidate: { select: { id: true, firstName: true, lastName: true, email: true, phone: true, currentRole: true } },
      },
    }),
  ]);

  const applications = applicationRows.map((x) => ({
    id: x.id, jobId: x.jobId, candidateId: x.candidateId, stage: x.stage, rating: x.rating,
    interviewAt: x.interviewAt, offerAmount: money(x.offerAmount), rejectionReason: x.rejectionReason,
    notes: x.notes, stageChangedAt: x.stageChangedAt, createdAt: x.createdAt, job: x.job, candidate: x.candidate,
  }));
  const countByJob = new Map<string, number>();
  for (const x of applications) countByJob.set(x.jobId, (countByJob.get(x.jobId) ?? 0) + 1);
  const hiredByJob = new Map<string, number>();
  for (const x of applications) if (x.stage === "HIRED") hiredByJob.set(x.jobId, (hiredByJob.get(x.jobId) ?? 0) + 1);

  const jobs = jobRows.map((j) => ({
    id: j.id, title: j.title, clientName: j.clientName, department: j.department, location: j.location,
    employmentType: j.employmentType, salaryMin: money(j.salaryMin), salaryMax: money(j.salaryMax),
    openings: j.openings, description: j.description, requirements: j.requirements, status: j.status, closesAt: j.closesAt,
    applicants: countByJob.get(j.id) ?? 0, hired: hiredByJob.get(j.id) ?? 0,
  }));
  const candidates = candidateRows.map((c) => ({
    id: c.id, firstName: c.firstName, lastName: c.lastName, email: c.email, phone: c.phone,
    currentRole: c.currentRole, currentCompany: c.currentCompany, location: c.location, skills: c.skills,
    source: c.source, cvUrl: c.cvUrl, notes: c.notes,
    applicationCount: applications.filter((x) => x.candidateId === c.id).length,
  }));

  const active = applications.filter((x) => !["HIRED", "REJECTED", "WITHDRAWN"].includes(x.stage));
  const stageCounts = Object.fromEntries(RECRUIT_STAGES.map((s) => [s, applications.filter((x) => x.stage === s).length])) as Record<(typeof RECRUIT_STAGES)[number], number>;
  const now = new Date();
  return {
    jobs, candidates, applications, stageCounts,
    openJobs: jobs.filter((j) => j.status === "OPEN").length,
    activeApplications: active.length,
    upcomingInterviews: applications
      .filter((x) => x.stage === "INTERVIEW" && x.interviewAt && new Date(x.interviewAt) >= now)
      .sort((p, q) => new Date(p.interviewAt!).getTime() - new Date(q.interviewAt!).getTime())
      .slice(0, 8),
    hiredCount: stageCounts.HIRED,
  };
}

export async function createRecruitJob(slug: string, form: FormData): Promise<ActionResult<{ id: string }>> {
  const a = await access(slug); if (!a.ok) return { success: false, error: a.error };
  const title = text(form, "title");
  if (!title) return { success: false, error: "A job title is required." };
  const employmentType = text(form, "employmentType") || "FULL_TIME";
  if (!(EMPLOYMENT_TYPES as readonly string[]).includes(employmentType)) return { success: false, error: "Invalid employment type." };
  const salaryMin = optMoney(form, "salaryMin"), salaryMax = optMoney(form, "salaryMax");
  if (Number.isNaN(salaryMin) || Number.isNaN(salaryMax)) return { success: false, error: "Salary values must be valid non-negative amounts." };
  if (salaryMin != null && salaryMax != null && salaryMax < salaryMin) return { success: false, error: "Maximum salary can't be lower than the minimum." };
  const openings = Math.max(1, Math.floor(Number(form.get("openings") || 1)) || 1);
  const status = text(form, "status") || "OPEN";
  if (!(JOB_STATUSES as readonly string[]).includes(status)) return { success: false, error: "Invalid job status." };
  const closes = text(form, "closesAt");
  const job = await prisma.recruitJob.create({
    data: {
      storeId: a.store.id, title, clientName: text(form, "clientName") || null, department: text(form, "department") || null,
      location: text(form, "location") || null, employmentType, salaryMin, salaryMax, openings,
      description: text(form, "description") || null, requirements: text(form, "requirements") || null,
      status: status as never, closesAt: closes ? new Date(closes) : null,
    },
  });
  await log(a.store.id, "recruitment.job_created", job.title);
  return { success: true, data: { id: job.id } };
}

export async function setRecruitJobStatus(slug: string, jobId: string, status: string): Promise<ActionResult<void>> {
  const a = await access(slug); if (!a.ok) return { success: false, error: a.error };
  if (!(JOB_STATUSES as readonly string[]).includes(status)) return { success: false, error: "Invalid job status." };
  const job = await prisma.recruitJob.findFirst({ where: { id: jobId, storeId: a.store.id } });
  if (!job) return { success: false, error: "Job not found." };
  await prisma.recruitJob.update({ where: { id: job.id }, data: { status: status as never } });
  await log(a.store.id, "recruitment.job_status", `${job.title} → ${status}`);
  return { success: true, data: undefined };
}

export async function deleteRecruitJob(slug: string, jobId: string): Promise<ActionResult<void>> {
  const a = await access(slug); if (!a.ok) return { success: false, error: a.error };
  const job = await prisma.recruitJob.findFirst({ where: { id: jobId, storeId: a.store.id } });
  if (!job) return { success: false, error: "Job not found." };
  await prisma.recruitJob.delete({ where: { id: job.id } });
  await log(a.store.id, "recruitment.job_deleted", job.title);
  return { success: true, data: undefined };
}

export async function createRecruitCandidate(slug: string, form: FormData): Promise<ActionResult<{ id: string }>> {
  const a = await access(slug); if (!a.ok) return { success: false, error: a.error };
  const firstName = text(form, "firstName"), lastName = text(form, "lastName");
  if (!firstName || !lastName) return { success: false, error: "First and last name are required." };
  const email = text(form, "email").toLowerCase() || null;
  if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return { success: false, error: "Enter a valid email address." };
  const cvUrl = text(form, "cvUrl");
  if (cvUrl && !/^https?:\/\//i.test(cvUrl)) return { success: false, error: "The CV link must start with http:// or https://." };
  if (email) {
    const dup = await prisma.recruitCandidate.findFirst({ where: { storeId: a.store.id, email }, select: { firstName: true, lastName: true } });
    if (dup) return { success: false, error: `${dup.firstName} ${dup.lastName} is already in your talent pool with that email.` };
  }
  const candidate = await prisma.recruitCandidate.create({
    data: {
      storeId: a.store.id, firstName, lastName, email, phone: text(form, "phone") || null,
      currentRole: text(form, "currentRole") || null, currentCompany: text(form, "currentCompany") || null,
      location: text(form, "location") || null, skills: text(form, "skills") || null, source: text(form, "source") || null,
      cvUrl: cvUrl || null, notes: text(form, "notes") || null,
    },
  });
  // Optionally attach to a job in the same step.
  const jobId = text(form, "jobId");
  if (jobId) {
    const job = await prisma.recruitJob.findFirst({ where: { id: jobId, storeId: a.store.id }, select: { id: true } });
    if (job) await prisma.recruitApplication.create({ data: { storeId: a.store.id, jobId: job.id, candidateId: candidate.id } });
  }
  await log(a.store.id, "recruitment.candidate_added", `${firstName} ${lastName}`);
  return { success: true, data: { id: candidate.id } };
}

export async function deleteRecruitCandidate(slug: string, candidateId: string): Promise<ActionResult<void>> {
  const a = await access(slug); if (!a.ok) return { success: false, error: a.error };
  const c = await prisma.recruitCandidate.findFirst({ where: { id: candidateId, storeId: a.store.id } });
  if (!c) return { success: false, error: "Candidate not found." };
  await prisma.recruitCandidate.delete({ where: { id: c.id } });
  await log(a.store.id, "recruitment.candidate_deleted", `${c.firstName} ${c.lastName}`);
  return { success: true, data: undefined };
}

export async function applyCandidateToJob(slug: string, candidateId: string, jobId: string): Promise<ActionResult<void>> {
  const a = await access(slug); if (!a.ok) return { success: false, error: a.error };
  const [candidate, job] = await Promise.all([
    prisma.recruitCandidate.findFirst({ where: { id: candidateId, storeId: a.store.id }, select: { id: true } }),
    prisma.recruitJob.findFirst({ where: { id: jobId, storeId: a.store.id }, select: { id: true, status: true } }),
  ]);
  if (!candidate || !job) return { success: false, error: "Candidate or job not found." };
  if (job.status === "CLOSED" || job.status === "FILLED") return { success: false, error: "This job is no longer accepting candidates." };
  const existing = await prisma.recruitApplication.findUnique({ where: { jobId_candidateId: { jobId, candidateId } }, select: { id: true } });
  if (existing) return { success: false, error: "This candidate is already on that job." };
  await prisma.recruitApplication.create({ data: { storeId: a.store.id, jobId, candidateId } });
  return { success: true, data: undefined };
}

export async function moveApplicationStage(
  slug: string, applicationId: string, stage: string,
  opts: { interviewAt?: string; offerAmount?: string; rejectionReason?: string } = {},
): Promise<ActionResult<void>> {
  const a = await access(slug); if (!a.ok) return { success: false, error: a.error };
  if (!(RECRUIT_STAGES as readonly string[]).includes(stage)) return { success: false, error: "Invalid stage." };
  const app = await prisma.recruitApplication.findFirst({
    where: { id: applicationId, storeId: a.store.id },
    include: { candidate: { select: { firstName: true, lastName: true } }, job: { select: { title: true } } },
  });
  if (!app) return { success: false, error: "Application not found." };
  const data: Record<string, unknown> = { stage, stageChangedAt: new Date() };
  if (stage === "INTERVIEW" && opts.interviewAt) {
    const d = new Date(opts.interviewAt);
    if (Number.isNaN(d.getTime())) return { success: false, error: "Enter a valid interview date and time." };
    data.interviewAt = d;
  }
  if (stage === "OFFER" && opts.offerAmount) {
    const n = Number(opts.offerAmount);
    if (!Number.isFinite(n) || n < 0) return { success: false, error: "Offer amount must be a valid non-negative amount." };
    data.offerAmount = n;
  }
  if (stage === "REJECTED") data.rejectionReason = (opts.rejectionReason || "").trim() || null;
  await prisma.recruitApplication.update({ where: { id: app.id }, data });
  await log(a.store.id, "recruitment.stage_changed", `${app.candidate.firstName} ${app.candidate.lastName} · ${app.job.title} → ${stage}`);
  return { success: true, data: undefined };
}

export async function updateApplicationReview(slug: string, applicationId: string, rating: number | null, notes: string): Promise<ActionResult<void>> {
  const a = await access(slug); if (!a.ok) return { success: false, error: a.error };
  if (rating != null && (!Number.isInteger(rating) || rating < 1 || rating > 5)) return { success: false, error: "Rating must be between 1 and 5." };
  const app = await prisma.recruitApplication.findFirst({ where: { id: applicationId, storeId: a.store.id }, select: { id: true } });
  if (!app) return { success: false, error: "Application not found." };
  await prisma.recruitApplication.update({ where: { id: app.id }, data: { rating, notes: notes.trim() || null } });
  return { success: true, data: undefined };
}
