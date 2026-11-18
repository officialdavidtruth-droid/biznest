"use server";

import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { assertAnyStorePermission } from "@/lib/access/assert-store-access";
import { getStoreAccessRole } from "@/lib/access/store-access";
import { getPluginEntitlement } from "@/lib/plugins";
import { logStoreActivity } from "@/lib/activity-log";
import { findMyEmployee } from "@/lib/hr/self";
import { parsePunchCsv, workDateFor, zoneOffsetMinutes } from "@/lib/hr/attendance-core";
import {
  getHrSettings, hashDeviceKey, newDeviceKey, recordPunches, rematchPunches, scansToPunches, storeTimeZone,
} from "@/lib/hr/attendance-service";
import type { ActionResult } from "@/types/actions";

const HR_PERMISSIONS = ["hr", "plugin:hr-payroll"] as const;
const money = (v: unknown) => Number(v ?? 0);

async function access(slug: string) {
  const a = await assertAnyStorePermission(slug, [...HR_PERMISSIONS]);
  if (!a.success) return { ok: false as const, error: a.error };
  const e = await getPluginEntitlement(a.store.id, "hr-payroll");
  if (!e.allowed) return { ok: false as const, error: e.reason };
  if (!e.installed) return { ok: false as const, error: "Install HR & Payroll to use this workspace." };
  return { ok: true as const, store: a.store };
}

// ---------- admin: scanners, settings, imports, employee editing ----------

export async function getBiometricSetup(slug: string) {
  const a = await access(slug);
  if (!a.ok) return { error: a.error };
  const [devices, settings, unmatched, staff, credentials] = await Promise.all([
    prisma.hrBiometricDevice.findMany({ where: { storeId: a.store.id }, orderBy: { createdAt: "asc" } }),
    getHrSettings(a.store.id),
    prisma.hrPunch.groupBy({ by: ["deviceUserId"], where: { storeId: a.store.id, employeeId: null, deviceUserId: { not: null } }, _count: { _all: true } }),
    prisma.storeStaff.findMany({ where: { storeId: a.store.id, status: "ACTIVE" }, select: { id: true, invitedName: true, invitedEmail: true, username: true } }),
    prisma.hrWebAuthnCredential.groupBy({ by: ["employeeId"], where: { storeId: a.store.id }, _count: { _all: true } }),
  ]);
  return {
    devices: devices.map((d: { id: string; name: string; serialNumber: string; tzOffsetMinutes: number; lastSeenAt: Date | null; lastPunchAt: Date | null }) => ({
      id: d.id, name: d.name, serialNumber: d.serialNumber, tzOffsetMinutes: d.tzOffsetMinutes, lastSeenAt: d.lastSeenAt, lastPunchAt: d.lastPunchAt,
    })),
    settings,
    unmatched: unmatched.map((u: { deviceUserId: string | null; _count: { _all: number } }) => ({ deviceUserId: u.deviceUserId as string, scans: u._count._all })),
    staff,
    biometricEmployeeIds: credentials.map((c: { employeeId: string }) => c.employeeId),
  };
}

export async function addBiometricDevice(slug: string, name: string, serialNumber: string, tzOffsetMinutes = 60): Promise<ActionResult<{ id: string; key: string }>> {
  const a = await access(slug); if (!a.ok) return { success: false, error: a.error };
  const serial = serialNumber.trim();
  if (!name.trim() || serial.length < 3) return { success: false, error: "Enter a name and the scanner's serial number." };
  if (!Number.isInteger(tzOffsetMinutes) || Math.abs(tzOffsetMinutes) > 840) return { success: false, error: "Invalid time zone offset." };
  const key = newDeviceKey();
  try {
    const d = await prisma.hrBiometricDevice.create({ data: { storeId: a.store.id, name: name.trim().slice(0, 60), serialNumber: serial, apiKeyHash: hashDeviceKey(key), tzOffsetMinutes } });
    return { success: true, data: { id: d.id, key } };
  } catch {
    return { success: false, error: "A scanner with that serial number is already registered." };
  }
}

export async function rotateBiometricDeviceKey(slug: string, id: string): Promise<ActionResult<{ key: string }>> {
  const a = await access(slug); if (!a.ok) return { success: false, error: a.error };
  const d = await prisma.hrBiometricDevice.findFirst({ where: { id, storeId: a.store.id } });
  if (!d) return { success: false, error: "Scanner not found." };
  const key = newDeviceKey();
  await prisma.hrBiometricDevice.update({ where: { id }, data: { apiKeyHash: hashDeviceKey(key) } });
  return { success: true, data: { key } };
}

export async function removeBiometricDevice(slug: string, id: string): Promise<ActionResult<void>> {
  const a = await access(slug); if (!a.ok) return { success: false, error: a.error };
  const r = await prisma.hrBiometricDevice.deleteMany({ where: { id, storeId: a.store.id } });
  return r.count ? { success: true, data: undefined } : { success: false, error: "Scanner not found." };
}

export async function saveHrSettings(slug: string, shiftStart: string, graceMinutes: number, requireBiometric: boolean): Promise<ActionResult<void>> {
  const a = await access(slug); if (!a.ok) return { success: false, error: a.error };
  if (!/^([01]?\d|2[0-3]):[0-5]\d$/.test(shiftStart)) return { success: false, error: "Enter the start time like 09:00." };
  if (!Number.isInteger(graceMinutes) || graceMinutes < 0 || graceMinutes > 180) return { success: false, error: "Grace period must be 0-180 minutes." };
  await prisma.hrSettings.upsert({
    where: { storeId: a.store.id },
    create: { storeId: a.store.id, shiftStart, graceMinutes, requireBiometric },
    update: { shiftStart, graceMinutes, requireBiometric },
  });
  return { success: true, data: undefined };
}

/** Import scans exported from any scanner (CSV: user ID, date and time). Duplicates are ignored. */
export async function importPunchesCsv(slug: string, csv: string): Promise<ActionResult<{ stored: number; unmatched: number; skipped: number }>> {
  const a = await access(slug); if (!a.ok) return { success: false, error: a.error };
  if (csv.length > 2_000_000) return { success: false, error: "That file is too large. Import it in smaller parts." };
  const { rows, skipped: badRows } = parsePunchCsv(csv);
  if (!rows.length) return { success: false, error: "No scans found. Each line needs a user ID and a date and time, e.g. 12,2026-11-18 08:02:11." };
  const tz = await storeTimeZone(a.store.id);
  const offset = zoneOffsetMinutes(new Date(), tz);
  const { punches, skipped } = scansToPunches(rows, { id: "", tzOffsetMinutes: offset }, "IMPORT");
  const r = await recordPunches(a.store.id, punches.map((p) => ({ ...p, deviceId: null })));
  return { success: true, data: { stored: r.stored, unmatched: r.unmatched, skipped: skipped + badRows } };
}

export async function updateHrEmployee(slug: string, id: string, form: FormData): Promise<ActionResult<void>> {
  const a = await access(slug); if (!a.ok) return { success: false, error: a.error };
  const text = (k: string) => String(form.get(k) || "").trim();
  const num = (k: string) => Number(form.get(k) || 0);
  const employee = await prisma.hrEmployee.findFirst({ where: { id, storeId: a.store.id } });
  if (!employee) return { success: false, error: "Employee not found." };
  const firstName = text("firstName"), lastName = text("lastName");
  if (!firstName || !lastName) return { success: false, error: "First and last name are required." };
  const amounts = [num("basicSalary"), num("housingAllowance"), num("transportAllowance"), num("otherAllowance"), num("annualRent")];
  if (amounts.some((x) => !Number.isFinite(x) || x < 0)) return { success: false, error: "Salary and rent values must be valid non-negative amounts." };
  const deviceUserId = text("deviceUserId") || null;
  const staffId = text("staffId") || null;
  if (staffId && !(await prisma.storeStaff.findFirst({ where: { id: staffId, storeId: a.store.id } }))) return { success: false, error: "That login doesn't belong to this store." };
  try {
    await prisma.hrEmployee.update({
      where: { id },
      data: {
        firstName, lastName, email: text("email") || null, phone: text("phone") || null,
        department: text("department") || null, position: text("position") || null,
        basicSalary: amounts[0], housingAllowance: amounts[1], transportAllowance: amounts[2], otherAllowance: amounts[3], annualRent: amounts[4],
        bankName: text("bankName") || null, accountName: text("accountName") || null, accountNumber: text("accountNumber") || null,
        deviceUserId, staffId,
      },
    });
  } catch {
    return { success: false, error: "That scanner ID or login is already used by another employee." };
  }
  if (deviceUserId) await rematchPunches(a.store.id, id, deviceUserId);
  const s = await auth();
  await logStoreActivity({ storeId: a.store.id, actor: { id: s?.user?.id, name: s?.user?.name, email: s?.user?.email, role: s?.user?.role ?? "OWNER" }, action: "hr.employee_updated", target: employee.employeeNo });
  return { success: true, data: undefined };
}

/** Payslip list for one payroll run (HR view). */
export async function getPayrollRunItems(slug: string, runId: string) {
  const a = await access(slug);
  if (!a.ok) return { error: a.error };
  const run = await prisma.hrPayrollRun.findFirst({ where: { id: runId, storeId: a.store.id } });
  if (!run) return { error: "Payroll run not found." };
  const items = await prisma.hrPayrollItem.findMany({ where: { payrollRunId: runId }, include: { employee: { select: { firstName: true, lastName: true, employeeNo: true } } }, orderBy: { employee: { firstName: "asc" } } });
  return { items: items.map((i: { id: string; gross: unknown; deductions: unknown; net: unknown; employee: { firstName: string; lastName: string; employeeNo: string } }) => ({ id: i.id, name: `${i.employee.firstName} ${i.employee.lastName}`, employeeNo: i.employee.employeeNo, gross: money(i.gross), deductions: money(i.deductions), net: money(i.net) })) };
}

// ---------- worker self-service (any signed-in member linked to an employee record) ----------

async function me(slug: string) {
  const session = await auth();
  if (!session?.user?.id) return { ok: false as const, error: "Sign in first." };
  const store = await prisma.store.findUnique({ where: { slug }, include: { business: { select: { userId: true } } } });
  if (!store) return { ok: false as const, error: "Store not found." };
  // Must be the owner or an active member of this store; no extra permission needed to see your own data.
  const role = await getStoreAccessRole(session.user.id, session.user.role, store);
  if (role === null) return { ok: false as const, error: "You don't have access to this store." };
  const employee = await findMyEmployee(store.id, { id: session.user.id, email: session.user.email });
  if (!employee) return { ok: false as const, error: "NOT_LINKED" };
  return { ok: true as const, store: { id: store.id, name: store.name }, employee };
}

export async function getMyWork(slug: string) {
  const m = await me(slug);
  if (!m.ok) return { error: m.error };
  const tz = await storeTimeZone(m.store.id);
  const today = workDateFor(new Date(), tz);
  const [attendance, settings, credentials, items, recent] = await Promise.all([
    prisma.hrAttendance.findUnique({ where: { employeeId_workDate: { employeeId: m.employee.id, workDate: today } } }),
    getHrSettings(m.store.id),
    prisma.hrWebAuthnCredential.findMany({ where: { employeeId: m.employee.id }, select: { id: true, label: true, createdAt: true, lastUsedAt: true } }),
    prisma.hrPayrollItem.findMany({ where: { employeeId: m.employee.id, payrollRun: { status: { in: ["APPROVED", "PAID"] } } }, include: { payrollRun: true }, orderBy: { payrollRun: { periodEnd: "desc" } }, take: 24 }),
    prisma.hrAttendance.findMany({ where: { employeeId: m.employee.id }, orderBy: { workDate: "desc" }, take: 10 }),
  ]);
  return {
    name: `${m.employee.firstName} ${m.employee.lastName}`,
    timeZone: tz,
    today: attendance ? { status: attendance.status, checkIn: attendance.checkIn, checkOut: attendance.checkOut } : null,
    requireBiometric: settings.requireBiometric,
    credentials,
    payslips: items.map((i: { id: string; net: unknown; payrollRun: { periodStart: Date; periodEnd: Date; status: string } }) => ({ id: i.id, periodStart: i.payrollRun.periodStart, periodEnd: i.payrollRun.periodEnd, status: i.payrollRun.status, net: money(i.net) })),
    recent: recent.map((r: { workDate: Date; status: string; checkIn: Date | null; checkOut: Date | null }) => ({ workDate: r.workDate, status: r.status, checkIn: r.checkIn, checkOut: r.checkOut })),
  };
}

/** Plain clock-in/out button (no biometric). Refused when the business requires biometrics. */
export async function clockSelf(slug: string): Promise<ActionResult<{ at: Date }>> {
  const m = await me(slug);
  if (!m.ok) return { success: false, error: m.error === "NOT_LINKED" ? "Your login isn't linked to an employee record yet." : m.error };
  const settings = await getHrSettings(m.store.id);
  if (settings.requireBiometric) return { success: false, error: "Your employer requires fingerprint or face to clock in." };
  const at = new Date();
  await recordPunches(m.store.id, [{ at, source: "SELF", employeeId: m.employee.id }]);
  return { success: true, data: { at } };
}

export async function removeMyCredential(slug: string, id: string): Promise<ActionResult<void>> {
  const m = await me(slug);
  if (!m.ok) return { success: false, error: m.error };
  const r = await prisma.hrWebAuthnCredential.deleteMany({ where: { id, employeeId: m.employee.id } });
  return r.count ? { success: true, data: undefined } : { success: false, error: "Not found." };
}
