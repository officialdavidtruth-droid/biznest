"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { assertStorePermission } from "@/lib/access/assert-store-access";
import { markRentChargePaid } from "@/lib/payments/rent-receipt";
import {
  MAINTENANCE_PRIORITIES, MAINTENANCE_STATUSES, RENT_PAYMENT_METHODS, buildRentSchedule, isRentCycle, money, newPortalToken, sanitizeTenant,
  type RentCycle,
} from "@/lib/real-estate";
import type { ActionResult } from "@/types/actions";

// Landlord / property-manager side of real-estate rent collection. Every query is scoped to the caller's store.

const fail = (error: string): ActionResult<never> => ({ success: false, error });
const refresh = (slug: string) => revalidatePath(`/store/${slug}/admin/real-estate`);

async function access(slug: string) {
  return assertStorePermission(slug, "products");
}

async function ownedUnit(storeId: string, unitId: string) {
  return prisma.realEstateUnit.findFirst({ where: { id: unitId, property: { storeId } }, include: { property: { select: { name: true } } } });
}

function parseDate(v: unknown): Date | null {
  if (v == null || v === "") return null;
  const d = new Date(String(v));
  return Number.isNaN(d.getTime()) ? null : d;
}

export async function updateRealEstateUnit(slug: string, unitId: string, input: { unitNo?: string; rentAmount?: number | null; rentCycle?: string; leaseStart?: string | null; leaseEnd?: string | null }): Promise<ActionResult> {
  const a = await access(slug); if (!a.success) return fail(a.error);
  const unit = await ownedUnit(a.store.id, unitId);
  if (!unit) return fail("Unit not found.");
  const data: Record<string, unknown> = {};
  if (input.unitNo !== undefined) {
    const no = input.unitNo.trim().slice(0, 40);
    if (!no) return fail("Enter a unit number.");
    data.unitNo = no;
  }
  if (input.rentAmount !== undefined) {
    if (input.rentAmount === null) data.rentAmount = null;
    else {
      const r = money(input.rentAmount);
      if (Number.isNaN(r) || r < 0) return fail("Enter a valid rent amount.");
      data.rentAmount = r;
    }
  }
  if (input.rentCycle !== undefined) {
    if (!isRentCycle(input.rentCycle)) return fail("Choose how often rent is paid.");
    data.rentCycle = input.rentCycle;
  }
  if (input.leaseStart !== undefined) data.leaseStart = parseDate(input.leaseStart);
  if (input.leaseEnd !== undefined) data.leaseEnd = parseDate(input.leaseEnd);
  try {
    await prisma.realEstateUnit.update({ where: { id: unit.id }, data });
  } catch {
    return fail("That unit number is already used in this property.");
  }
  refresh(slug);
  return { success: true, data: undefined };
}

/** Puts a tenant in a unit, marks it occupied and opens the tenant's portal link. */
export async function assignTenant(slug: string, unitId: string, input: { name: string; email?: string; phone?: string; leaseStart?: string | null; leaseEnd?: string | null; rentCycle?: string; rentAmount?: number }): Promise<ActionResult<{ portalToken: string }>> {
  const a = await access(slug); if (!a.success) return fail(a.error);
  const unit = await ownedUnit(a.store.id, unitId);
  if (!unit) return fail("Unit not found.");
  const t = sanitizeTenant(input);
  if (!t.ok) return fail(t.error);
  const cycle: RentCycle = isRentCycle(input.rentCycle) ? input.rentCycle : (isRentCycle(unit.rentCycle) ? unit.rentCycle : "ANNUAL");
  const leaseStart = parseDate(input.leaseStart), leaseEnd = parseDate(input.leaseEnd);
  if (leaseStart && leaseEnd && leaseEnd <= leaseStart) return fail("The lease must end after it starts.");
  const rent = input.rentAmount === undefined ? undefined : money(input.rentAmount);
  if (rent !== undefined && (Number.isNaN(rent) || rent < 0)) return fail("Enter a valid rent amount.");
  const portalToken = unit.portalToken ?? newPortalToken();
  await prisma.realEstateUnit.update({
    where: { id: unit.id },
    data: { tenantName: t.tenant.name, tenantEmail: t.tenant.email, tenantPhone: t.tenant.phone, status: "OCCUPIED", rentCycle: cycle, leaseStart, leaseEnd, portalToken, ...(rent !== undefined ? { rentAmount: rent } : {}) },
  });
  refresh(slug);
  return { success: true, data: { portalToken } };
}

/** Ends a tenancy: the unit goes vacant and the old portal link stops working. Unpaid charges stay on record. */
export async function endTenancy(slug: string, unitId: string): Promise<ActionResult> {
  const a = await access(slug); if (!a.success) return fail(a.error);
  const unit = await ownedUnit(a.store.id, unitId);
  if (!unit) return fail("Unit not found.");
  await prisma.realEstateUnit.update({ where: { id: unit.id }, data: { tenantName: null, tenantEmail: null, tenantPhone: null, status: "VACANT", portalToken: null } });
  refresh(slug);
  return { success: true, data: undefined };
}

/** Replaces the tenant's portal link (use if it was shared by mistake). The old link stops working. */
export async function regenerateRentPortalLink(slug: string, unitId: string): Promise<ActionResult<{ portalToken: string }>> {
  const a = await access(slug); if (!a.success) return fail(a.error);
  const unit = await ownedUnit(a.store.id, unitId);
  if (!unit) return fail("Unit not found.");
  if (!unit.tenantName) return fail("Add a tenant first.");
  const portalToken = newPortalToken();
  await prisma.realEstateUnit.update({ where: { id: unit.id }, data: { portalToken } });
  refresh(slug);
  return { success: true, data: { portalToken } };
}

/** Creates one rent charge per period from the unit's rent and cycle. Periods that already have a charge are skipped. */
export async function generateRentSchedule(slug: string, unitId: string, input: { startDate: string; periods: number }): Promise<ActionResult<{ created: number; skipped: number }>> {
  const a = await access(slug); if (!a.success) return fail(a.error);
  const unit = await ownedUnit(a.store.id, unitId);
  if (!unit) return fail("Unit not found.");
  if (!unit.tenantName) return fail("Add a tenant before creating rent charges.");
  const rent = Number(unit.rentAmount ?? 0);
  if (!(rent > 0)) return fail("Set the rent amount for this unit first.");
  const start = parseDate(input.startDate);
  if (!start) return fail("Choose the date the first rent is due.");
  const cycle: RentCycle = isRentCycle(unit.rentCycle) ? unit.rentCycle : "ANNUAL";
  const schedule = buildRentSchedule({ start, cycle, periods: Number(input.periods) || 1, leaseEnd: unit.leaseEnd });
  const existing = await prisma.rentCharge.findMany({ where: { unitId: unit.id, status: { not: "VOID" } }, select: { dueDate: true } });
  const taken = new Set(existing.map((e) => e.dueDate.toISOString().slice(0, 10)));
  const fresh = schedule.filter((s) => !taken.has(s.dueDate.toISOString().slice(0, 10)));
  if (fresh.length) {
    await prisma.rentCharge.createMany({ data: fresh.map((s) => ({ storeId: a.store.id, unitId: unit.id, label: `Rent ${s.label}`, amount: rent, dueDate: s.dueDate })) });
  }
  refresh(slug);
  return { success: true, data: { created: fresh.length, skipped: schedule.length - fresh.length } };
}

/** A one-off charge: service charge, caution fee, repair recharge. */
export async function addRentCharge(slug: string, unitId: string, input: { label: string; amount: number; dueDate: string }): Promise<ActionResult> {
  const a = await access(slug); if (!a.success) return fail(a.error);
  const unit = await ownedUnit(a.store.id, unitId);
  if (!unit) return fail("Unit not found.");
  const label = input.label.replace(/\s+/g, " ").trim().slice(0, 120);
  if (!label) return fail("Give the charge a name.");
  const amount = money(input.amount);
  if (Number.isNaN(amount) || amount <= 0) return fail("Enter an amount greater than zero.");
  const dueDate = parseDate(input.dueDate);
  if (!dueDate) return fail("Choose a due date.");
  await prisma.rentCharge.create({ data: { storeId: a.store.id, unitId: unit.id, label, amount, dueDate } });
  refresh(slug);
  return { success: true, data: undefined };
}

/** Records rent received outside the portal (cash, bank transfer, POS) and issues a receipt number. */
export async function recordRentPayment(slug: string, chargeId: string, input: { method: string; reference?: string; note?: string; paidAt?: string }): Promise<ActionResult<{ receiptNo: string }>> {
  const a = await access(slug); if (!a.success) return fail(a.error);
  if (!(RENT_PAYMENT_METHODS as readonly string[]).includes(input.method)) return fail("Choose how it was paid.");
  const charge = await prisma.rentCharge.findFirst({ where: { id: chargeId, storeId: a.store.id } });
  if (!charge) return fail("Charge not found.");
  if (charge.status !== "DUE") return fail(charge.status === "PAID" ? "This charge is already paid." : "This charge was cancelled.");
  const paidAt = parseDate(input.paidAt) ?? new Date();
  if (paidAt.getTime() > Date.now() + 86_400_000) return fail("The payment date can't be in the future.");
  const reference = input.reference?.trim().slice(0, 80) || null;
  const note = input.note?.trim().slice(0, 300) || null;
  const receiptNo = await prisma.$transaction((tx) => markRentChargePaid(tx, { chargeId: charge.id, storeId: a.store.id, method: input.method, reference, note, paidAt }));
  if (!receiptNo) return fail("This charge was just paid or cancelled. Refresh and check.");
  refresh(slug);
  return { success: true, data: { receiptNo } };
}

export async function voidRentCharge(slug: string, chargeId: string): Promise<ActionResult> {
  const a = await access(slug); if (!a.success) return fail(a.error);
  const res = await prisma.rentCharge.updateMany({ where: { id: chargeId, storeId: a.store.id, status: "DUE" }, data: { status: "VOID" } });
  if (res.count === 0) return fail("Only unpaid charges can be cancelled.");
  refresh(slug);
  return { success: true, data: undefined };
}

// ---------------------------------------------------------------- maintenance

export async function createMaintenanceRequest(slug: string, unitId: string, input: { title: string; detail?: string; priority?: string }): Promise<ActionResult> {
  const a = await access(slug); if (!a.success) return fail(a.error);
  const unit = await ownedUnit(a.store.id, unitId);
  if (!unit) return fail("Unit not found.");
  const title = input.title.replace(/\s+/g, " ").trim().slice(0, 140);
  if (!title) return fail("Describe the problem in a few words.");
  const priority = (MAINTENANCE_PRIORITIES as readonly string[]).includes(input.priority ?? "") ? input.priority! : "NORMAL";
  await prisma.maintenanceRequest.create({ data: { storeId: a.store.id, unitId: unit.id, title, detail: input.detail?.trim().slice(0, 1000) || null, priority, reportedBy: "STAFF" } });
  refresh(slug);
  return { success: true, data: undefined };
}

export async function updateMaintenanceRequest(slug: string, id: string, input: { status?: string; vendor?: string | null; cost?: number | null }): Promise<ActionResult> {
  const a = await access(slug); if (!a.success) return fail(a.error);
  const req = await prisma.maintenanceRequest.findFirst({ where: { id, storeId: a.store.id } });
  if (!req) return fail("Request not found.");
  const data: Record<string, unknown> = {};
  if (input.status !== undefined) {
    if (!(MAINTENANCE_STATUSES as readonly string[]).includes(input.status)) return fail("Choose a valid status.");
    data.status = input.status;
    data.resolvedAt = input.status === "DONE" ? new Date() : null;
  }
  if (input.vendor !== undefined) data.vendor = input.vendor?.trim().slice(0, 120) || null;
  if (input.cost !== undefined) {
    if (input.cost === null) data.cost = null;
    else {
      const c = money(input.cost);
      if (Number.isNaN(c) || c < 0) return fail("Enter a valid cost.");
      data.cost = c;
    }
  }
  await prisma.maintenanceRequest.update({ where: { id: req.id }, data });
  refresh(slug);
  return { success: true, data: undefined };
}
