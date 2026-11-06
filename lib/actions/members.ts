"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { assertStorePermission } from "@/lib/access/assert-store-access";
import { markMemberChargePaid } from "@/lib/payments/member-receipt";
import {
  MEMBER_PAYMENT_METHODS, MEMBERSHIP_STATUSES, buildEnrollment, checkInDecision, isPlanInterval, isPlanKind, money, newPortalToken, sanitizeGift, sanitizeMember,
} from "@/lib/members";
import type { ActionResult } from "@/types/actions";

// Staff side of members, packages and giving. Every query is scoped to the caller's store.

const fail = (error: string): ActionResult<never> => ({ success: false, error });
const refresh = (slug: string) => revalidatePath(`/store/${slug}/admin/members`);
const access = (slug: string) => assertStorePermission(slug, "products");

function parseDate(v: unknown): Date | null {
  if (v == null || v === "") return null;
  const d = new Date(String(v));
  return Number.isNaN(d.getTime()) ? null : d;
}

export async function createMember(slug: string, input: { name: string; email?: string; phone?: string; notes?: string }): Promise<ActionResult<{ id: string; portalToken: string }>> {
  const a = await access(slug); if (!a.success) return fail(a.error);
  const m = sanitizeMember(input);
  if (!m.ok) return fail(m.error);
  const portalToken = newPortalToken();
  const row = await prisma.member.create({ data: { storeId: a.store.id, ...m.member, notes: input.notes?.trim().slice(0, 500) || null, portalToken }, select: { id: true } });
  refresh(slug);
  return { success: true, data: { id: row.id, portalToken } };
}

export async function updateMember(slug: string, memberId: string, input: { name?: string; email?: string; phone?: string; notes?: string }): Promise<ActionResult> {
  const a = await access(slug); if (!a.success) return fail(a.error);
  const cur = await prisma.member.findFirst({ where: { id: memberId, storeId: a.store.id } });
  if (!cur) return fail("Not found.");
  const m = sanitizeMember({ name: input.name ?? cur.name, email: input.email ?? cur.email, phone: input.phone ?? cur.phone });
  if (!m.ok) return fail(m.error);
  await prisma.member.update({ where: { id: cur.id }, data: { ...m.member, ...(input.notes !== undefined ? { notes: input.notes.trim().slice(0, 500) || null } : {}) } });
  refresh(slug);
  return { success: true, data: undefined };
}

export async function setMemberActive(slug: string, memberId: string, active: boolean): Promise<ActionResult> {
  const a = await access(slug); if (!a.success) return fail(a.error);
  const res = await prisma.member.updateMany({ where: { id: memberId, storeId: a.store.id }, data: { active } });
  if (res.count === 0) return fail("Not found.");
  refresh(slug);
  return { success: true, data: undefined };
}

/** Replaces the member's secret link (if it was shared by mistake). The old link stops working. */
export async function regenerateMemberLink(slug: string, memberId: string): Promise<ActionResult<{ portalToken: string }>> {
  const a = await access(slug); if (!a.success) return fail(a.error);
  const portalToken = newPortalToken();
  const res = await prisma.member.updateMany({ where: { id: memberId, storeId: a.store.id }, data: { portalToken } });
  if (res.count === 0) return fail("Not found.");
  refresh(slug);
  return { success: true, data: { portalToken } };
}

type PlanInput = { name: string; kind: string; price?: number; interval?: string; sessions?: number | null; validityDays?: number | null; description?: string };

function cleanPlan(input: PlanInput): { ok: true; data: { name: string; kind: string; price: number; interval: string; sessions: number | null; validityDays: number | null; description: string | null } } | { ok: false; error: string } {
  const name = String(input.name ?? "").replace(/\s+/g, " ").trim().slice(0, 100);
  if (!name) return { ok: false, error: "Give it a name." };
  if (!isPlanKind(input.kind)) return { ok: false, error: "Choose a type." };
  const price = input.kind === "FUND" ? 0 : money(input.price);
  if (Number.isNaN(price) || price < 0) return { ok: false, error: "Enter a valid price." };
  const interval = isPlanInterval(input.interval) ? input.interval : input.kind === "PACKAGE" ? "ONCE" : "MONTHLY";
  const sessions = input.kind === "PACKAGE" && input.sessions ? Math.floor(Number(input.sessions)) : null;
  if (input.kind === "PACKAGE" && (!sessions || sessions < 1 || sessions > 1000)) return { ok: false, error: "A package needs a number of sessions." };
  const validityDays = input.validityDays ? Math.floor(Number(input.validityDays)) : null;
  if (validityDays !== null && (validityDays < 1 || validityDays > 3650)) return { ok: false, error: "Validity must be between 1 and 3650 days." };
  return { ok: true, data: { name, kind: input.kind, price, interval, sessions, validityDays: input.kind === "PACKAGE" ? validityDays : null, description: input.description?.trim().slice(0, 300) || null } };
}

export async function createPlan(slug: string, input: PlanInput): Promise<ActionResult> {
  const a = await access(slug); if (!a.success) return fail(a.error);
  const p = cleanPlan(input); if (!p.ok) return fail(p.error);
  await prisma.memberPlan.create({ data: { storeId: a.store.id, ...p.data } });
  refresh(slug);
  return { success: true, data: undefined };
}

export async function updatePlan(slug: string, planId: string, input: PlanInput & { active?: boolean }): Promise<ActionResult> {
  const a = await access(slug); if (!a.success) return fail(a.error);
  const p = cleanPlan(input); if (!p.ok) return fail(p.error);
  const res = await prisma.memberPlan.updateMany({ where: { id: planId, storeId: a.store.id }, data: { ...p.data, ...(input.active !== undefined ? { active: input.active } : {}) } });
  if (res.count === 0) return fail("Not found.");
  refresh(slug);
  return { success: true, data: undefined };
}

/** Puts a member on a plan and bills the first period. Packages bill once and count down sessions. */
export async function enrollMember(slug: string, memberId: string, planId: string, startDate?: string): Promise<ActionResult<{ membershipId: string }>> {
  const a = await access(slug); if (!a.success) return fail(a.error);
  const [member, plan] = await Promise.all([
    prisma.member.findFirst({ where: { id: memberId, storeId: a.store.id, active: true } }),
    prisma.memberPlan.findFirst({ where: { id: planId, storeId: a.store.id, active: true } }),
  ]);
  if (!member) return fail("Member not found.");
  if (!plan || plan.kind === "FUND") return fail("Choose a plan or package.");
  const startsAt = parseDate(startDate) ?? new Date();
  const e = buildEnrollment({ name: plan.name, kind: plan.kind, price: Number(plan.price), interval: plan.interval, sessions: plan.sessions, validityDays: plan.validityDays }, startsAt);
  const id = await prisma.$transaction(async (tx) => {
    const ms = await tx.membership.create({ data: { storeId: a.store.id, memberId: member.id, planId: plan.id, startsAt, renewsAt: e.renewsAt, endsAt: e.endsAt, sessionsLeft: e.sessionsLeft }, select: { id: true } });
    if (e.firstCharge.amount > 0) {
      await tx.memberCharge.create({ data: { storeId: a.store.id, memberId: member.id, membershipId: ms.id, kind: e.firstCharge.kind, label: e.firstCharge.label, amount: e.firstCharge.amount, dueDate: e.firstCharge.dueDate } });
    }
    return ms.id;
  });
  refresh(slug);
  return { success: true, data: { membershipId: id } };
}

export async function changeMembershipStatus(slug: string, membershipId: string, status: string): Promise<ActionResult> {
  const a = await access(slug); if (!a.success) return fail(a.error);
  if (!(MEMBERSHIP_STATUSES as readonly string[]).includes(status)) return fail("Choose a valid status.");
  const res = await prisma.membership.updateMany({ where: { id: membershipId, storeId: a.store.id }, data: { status } });
  if (res.count === 0) return fail("Not found.");
  refresh(slug);
  return { success: true, data: undefined };
}

/** Records money received outside the portal and issues a receipt number. */
export async function recordMemberPayment(slug: string, chargeId: string, input: { method: string; reference?: string; note?: string; paidAt?: string }): Promise<ActionResult<{ receiptNo: string }>> {
  const a = await access(slug); if (!a.success) return fail(a.error);
  if (!(MEMBER_PAYMENT_METHODS as readonly string[]).includes(input.method)) return fail("Choose how it was paid.");
  const charge = await prisma.memberCharge.findFirst({ where: { id: chargeId, storeId: a.store.id } });
  if (!charge) return fail("Charge not found.");
  if (charge.status !== "DUE") return fail(charge.status === "PAID" ? "This is already paid." : "This was cancelled.");
  const paidAt = parseDate(input.paidAt) ?? new Date();
  if (paidAt.getTime() > Date.now() + 86_400_000) return fail("The payment date can't be in the future.");
  const receiptNo = await prisma.$transaction((tx) => markMemberChargePaid(tx, { chargeId: charge.id, storeId: a.store.id, method: input.method, reference: input.reference?.trim().slice(0, 80) || null, note: input.note?.trim().slice(0, 300) || null, paidAt }));
  if (!receiptNo) return fail("This was just paid or cancelled. Refresh and check.");
  refresh(slug);
  return { success: true, data: { receiptNo } };
}

export async function voidMemberCharge(slug: string, chargeId: string): Promise<ActionResult> {
  const a = await access(slug); if (!a.success) return fail(a.error);
  const res = await prisma.memberCharge.updateMany({ where: { id: chargeId, storeId: a.store.id, status: "DUE" }, data: { status: "VOID" } });
  if (res.count === 0) return fail("Only unpaid charges can be cancelled.");
  refresh(slug);
  return { success: true, data: undefined };
}

/** A one-off charge to a member (joining fee, extra class). */
export async function addMemberCharge(slug: string, memberId: string, input: { label: string; amount: number; dueDate: string }): Promise<ActionResult> {
  const a = await access(slug); if (!a.success) return fail(a.error);
  const member = await prisma.member.findFirst({ where: { id: memberId, storeId: a.store.id } });
  if (!member) return fail("Member not found.");
  const label = input.label.replace(/\s+/g, " ").trim().slice(0, 120);
  if (!label) return fail("Give the charge a name.");
  const amount = money(input.amount);
  if (Number.isNaN(amount) || amount <= 0) return fail("Enter an amount greater than zero.");
  const dueDate = parseDate(input.dueDate);
  if (!dueDate) return fail("Choose a due date.");
  await prisma.memberCharge.create({ data: { storeId: a.store.id, memberId: member.id, kind: "OTHER", label, amount, dueDate } });
  refresh(slug);
  return { success: true, data: undefined };
}

/** Records a gift received in person (offering, tithe, donation) straight to PAID with a receipt. memberId is optional. */
export async function recordGift(slug: string, input: { fund: string; amount: number; method: string; memberId?: string; donorName?: string; paidAt?: string; note?: string }): Promise<ActionResult<{ receiptNo: string }>> {
  const a = await access(slug); if (!a.success) return fail(a.error);
  if (!(MEMBER_PAYMENT_METHODS as readonly string[]).includes(input.method)) return fail("Choose how it was given.");
  const g = sanitizeGift({ fund: input.fund, amount: input.amount, name: input.donorName });
  if (!g.ok) return fail(g.error.replace(/smallest gift online is/, "smallest gift is"));
  let memberId: string | null = null;
  if (input.memberId) {
    const m = await prisma.member.findFirst({ where: { id: input.memberId, storeId: a.store.id }, select: { id: true } });
    if (!m) return fail("Member not found.");
    memberId = m.id;
  }
  const paidAt = parseDate(input.paidAt) ?? new Date();
  if (paidAt.getTime() > Date.now() + 86_400_000) return fail("The date can't be in the future.");
  const receiptNo = await prisma.$transaction(async (tx) => {
    const c = await tx.memberCharge.create({ data: { storeId: a.store.id, memberId, kind: "GIVING", fund: g.gift.fund, label: g.gift.fund, amount: g.gift.amount, dueDate: paidAt, donorName: g.gift.name } });
    return markMemberChargePaid(tx, { chargeId: c.id, storeId: a.store.id, method: input.method, note: input.note?.trim().slice(0, 300) || null, paidAt });
  });
  if (!receiptNo) return fail("Could not record the gift.");
  refresh(slug);
  return { success: true, data: { receiptNo } };
}

/** Checks a member in. Overdue dues block it unless `force`. Package sessions are deducted atomically. */
export async function checkInMember(slug: string, membershipId: string, input: { force?: boolean; note?: string } = {}): Promise<ActionResult<{ sessionsLeft: number | null }>> {
  const a = await access(slug); if (!a.success) return fail(a.error);
  const ms = await prisma.membership.findFirst({ where: { id: membershipId, storeId: a.store.id }, include: { member: { select: { active: true } } } });
  if (!ms || !ms.member.active) return fail("Membership not found.");
  const overdue = await prisma.memberCharge.count({ where: { storeId: a.store.id, membershipId: ms.id, status: "DUE", dueDate: { lt: new Date(Date.now() - 7 * 86_400_000) } } });
  const d = checkInDecision({ status: ms.status, startsAt: ms.startsAt, renewsAt: ms.renewsAt, endsAt: ms.endsAt, sessionsLeft: ms.sessionsLeft }, overdue > 0, new Date(), !!input.force);
  if (!d.ok) return fail(d.reason);
  let sessionsLeft = ms.sessionsLeft;
  if (d.useSession) {
    const res = await prisma.membership.updateMany({ where: { id: ms.id, sessionsLeft: { gt: 0 } }, data: { sessionsLeft: { decrement: 1 } } });
    if (res.count === 0) return fail("No sessions left.");
    sessionsLeft = (ms.sessionsLeft ?? 1) - 1;
  }
  await prisma.memberCheckIn.create({ data: { storeId: a.store.id, memberId: ms.memberId, membershipId: ms.id, note: input.note?.trim().slice(0, 200) || null, usedSession: d.useSession } });
  refresh(slug);
  return { success: true, data: { sessionsLeft } };
}
