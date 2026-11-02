"use server";

import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { assertAnyStorePermission } from "@/lib/access/assert-store-access";
import { getPluginEntitlement } from "@/lib/plugins";
import { logStoreActivity } from "@/lib/activity-log";
import { computeMonthlyPayroll } from "@/lib/hr/nigeria-payroll";
import type { ActionResult } from "@/types/actions";

// Staff can reach HR either through the "HR & payroll" checkbox or the plugin permission.
const HR_PERMISSIONS = ["hr", "plugin:hr-payroll"] as const;

async function access(slug: string) {
  const a = await assertAnyStorePermission(slug, [...HR_PERMISSIONS]);
  if (!a.success) return { ok: false as const, error: a.error };
  const e = await getPluginEntitlement(a.store.id, "hr-payroll");
  if (!e.allowed) return { ok: false as const, error: e.reason };
  if (!e.installed) return { ok: false as const, error: "Install HR & Payroll to use this workspace." };
  return { ok: true as const, store: a.store };
}

const money = (v: unknown) => Number(v ?? 0);
const text = (form: FormData, key: string) => String(form.get(key) || "").trim();
const startOfToday = () => { const d = new Date(); d.setHours(0, 0, 0, 0); return d; };

/**
 * Keeps ON_LEAVE in step with approved leave: anyone with approved leave covering today is
 * ON_LEAVE, anyone marked ON_LEAVE without it goes back to ACTIVE.
 */
async function syncLeaveStatus(storeId: string) {
  const today = startOfToday();
  const covering = { some: { status: "APPROVED" as const, startDate: { lte: today }, endDate: { gte: today } } };
  await prisma.$transaction([
    prisma.hrEmployee.updateMany({ where: { storeId, status: "ACTIVE", leaveRequests: covering }, data: { status: "ON_LEAVE" } }),
    prisma.hrEmployee.updateMany({ where: { storeId, status: "ON_LEAVE", leaveRequests: { none: covering.some } }, data: { status: "ACTIVE" } }),
  ]);
}

export async function getHrDashboard(slug: string) {
  const a = await access(slug);
  if (!a.ok) return { error: a.error };
  const storeId = a.store.id;
  await syncLeaveStatus(storeId);
  const today = startOfToday();
  const tomorrow = new Date(today); tomorrow.setDate(tomorrow.getDate() + 1);
  const live = { in: ["ACTIVE", "ON_LEAVE"] as ("ACTIVE" | "ON_LEAVE")[] };

  const [employeeRows, attendance, leaveRows, runRows] = await Promise.all([
    prisma.hrEmployee.findMany({ where: { storeId, status: { not: "EXITED" } }, orderBy: [{ firstName: "asc" }, { lastName: "asc" }] }),
    prisma.hrAttendance.findMany({
      where: { storeId, workDate: { gte: today, lt: tomorrow } },
      include: { employee: { select: { id: true, firstName: true, lastName: true, employeeNo: true, department: true } } },
    }),
    prisma.hrLeaveRequest.findMany({
      where: { storeId },
      include: { employee: { select: { id: true, firstName: true, lastName: true, employeeNo: true } } },
      orderBy: [{ createdAt: "desc" }],
      take: 100,
    }),
    prisma.hrPayrollRun.findMany({ where: { storeId }, orderBy: { periodEnd: "desc" }, take: 12 }),
  ]);

  const employees = employeeRows.map((e) => ({
    id: e.id, employeeNo: e.employeeNo, firstName: e.firstName, lastName: e.lastName,
    email: e.email, phone: e.phone, department: e.department, position: e.position,
    employmentType: e.employmentType, status: e.status, hireDate: e.hireDate,
    basicSalary: money(e.basicSalary), housingAllowance: money(e.housingAllowance),
    transportAllowance: money(e.transportAllowance), otherAllowance: money(e.otherAllowance),
    annualRent: money(e.annualRent),
  }));
  const payrollRuns = runRows.map((r) => ({
    id: r.id, periodStart: r.periodStart, periodEnd: r.periodEnd, payDate: r.payDate, status: r.status,
    totalGross: money(r.totalGross), totalDeductions: money(r.totalDeductions), totalNet: money(r.totalNet),
  }));
  const leaveRequests = leaveRows.map((l) => ({
    id: l.id, leaveType: l.leaveType, startDate: l.startDate, endDate: l.endDate, reason: l.reason,
    status: l.status, decisionNote: l.decisionNote, employee: l.employee,
  }));

  return {
    employees,
    activeCount: employees.filter((e) => live.in.includes(e.status as "ACTIVE" | "ON_LEAVE")).length,
    present: attendance.filter((x) => ["PRESENT", "LATE", "HALF_DAY"].includes(x.status)).length,
    pendingLeave: leaveRequests.filter((l) => l.status === "PENDING").length,
    latestRun: payrollRuns[0] ?? null,
    payrollRuns,
    leaveRequests,
    attendance,
    departments: Array.from(new Set(employees.map((e) => e.department).filter(Boolean))) as string[],
  };
}

export async function createHrEmployee(slug: string, form: FormData): Promise<ActionResult<{ id: string }>> {
  const a = await access(slug); if (!a.ok) return { success: false, error: a.error };
  const firstName = text(form, "firstName"), lastName = text(form, "lastName");
  const employeeNo = text(form, "employeeNo").toUpperCase();
  if (!firstName || !lastName || !employeeNo) return { success: false, error: "First name, last name and employee number are required." };
  const num = (k: string) => Number(form.get(k) || 0);
  const basic = num("basicSalary"), housing = num("housingAllowance"), transport = num("transportAllowance"), other = num("otherAllowance"), rent = num("annualRent");
  if ([basic, housing, transport, other, rent].some((x) => !Number.isFinite(x) || x < 0)) return { success: false, error: "Salary and rent values must be valid non-negative amounts." };
  try {
    const employee = await prisma.hrEmployee.create({
      data: {
        storeId: a.store.id, employeeNo, firstName, lastName,
        email: text(form, "email") || null, phone: text(form, "phone") || null,
        department: text(form, "department") || null, position: text(form, "position") || null,
        employmentType: (text(form, "employmentType") || "FULL_TIME") as never,
        hireDate: form.get("hireDate") ? new Date(String(form.get("hireDate"))) : null,
        basicSalary: basic, housingAllowance: housing, transportAllowance: transport, otherAllowance: other, annualRent: rent,
        bankName: text(form, "bankName") || null, accountName: text(form, "accountName") || null, accountNumber: text(form, "accountNumber") || null,
      },
    });
    const s = await auth();
    await logStoreActivity({ storeId: a.store.id, actor: { id: s?.user?.id, name: s?.user?.name, email: s?.user?.email, role: s?.user?.role ?? "OWNER" }, action: "hr.employee_created", target: employee.employeeNo });
    return { success: true, data: { id: employee.id } };
  } catch {
    return { success: false, error: "Employee number already exists or the employee could not be created." };
  }
}

export async function recordHrAttendance(slug: string, employeeId: string, status: string): Promise<ActionResult<void>> {
  const a = await access(slug); if (!a.ok) return { success: false, error: a.error };
  const allowed = ["PRESENT", "ABSENT", "LATE", "HALF_DAY", "ON_LEAVE"];
  if (!allowed.includes(status)) return { success: false, error: "Invalid attendance status." };
  const employee = await prisma.hrEmployee.findFirst({ where: { id: employeeId, storeId: a.store.id, status: { in: ["ACTIVE", "ON_LEAVE"] } } });
  if (!employee) return { success: false, error: "Employee not found." };
  const workDate = startOfToday();
  const present = status !== "ABSENT" && status !== "ON_LEAVE";
  await prisma.hrAttendance.upsert({
    where: { employeeId_workDate: { employeeId, workDate } },
    create: { storeId: a.store.id, employeeId, workDate, status: status as never, checkIn: present ? new Date() : null },
    // Changing PRESENT -> LATE should not overwrite the original check-in time.
    update: { status: status as never },
  });
  return { success: true, data: undefined };
}

export async function requestHrLeave(slug: string, employeeId: string, leaveType: string, startDate: string, endDate: string, reason?: string): Promise<ActionResult<void>> {
  const a = await access(slug); if (!a.ok) return { success: false, error: a.error };
  const start = new Date(startDate), end = new Date(endDate);
  if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime()) || end < start) return { success: false, error: "Enter a valid leave period." };
  const employee = await prisma.hrEmployee.findFirst({ where: { id: employeeId, storeId: a.store.id } });
  if (!employee) return { success: false, error: "Employee not found." };
  const overlap = await prisma.hrLeaveRequest.findFirst({ where: { employeeId, status: { in: ["PENDING", "APPROVED"] }, startDate: { lte: end }, endDate: { gte: start } } });
  if (overlap) return { success: false, error: "This employee already has an overlapping leave request." };
  await prisma.hrLeaveRequest.create({ data: { storeId: a.store.id, employeeId, leaveType: leaveType.trim() || "Annual", startDate: start, endDate: end, reason: reason?.trim() || null } });
  return { success: true, data: undefined };
}

export async function decideHrLeave(slug: string, id: string, status: "APPROVED" | "REJECTED", note?: string): Promise<ActionResult<void>> {
  const a = await access(slug); if (!a.ok) return { success: false, error: a.error };
  const row = await prisma.hrLeaveRequest.findFirst({ where: { id, storeId: a.store.id, status: "PENDING" } });
  if (!row) return { success: false, error: "Leave request not found or already decided." };
  await prisma.hrLeaveRequest.update({ where: { id }, data: { status, decisionNote: note?.trim() || null, decidedAt: new Date() } });
  // ON_LEAVE is applied/cleared by syncLeaveStatus based on the actual dates, so future leave
  // doesn't mark someone as away today.
  await syncLeaveStatus(a.store.id);
  return { success: true, data: undefined };
}

export async function createHrPayrollRun(
  slug: string,
  periodStart: string,
  periodEnd: string,
  opts: { applyStatutory?: boolean; applyNhf?: boolean } = {},
): Promise<ActionResult<{ id: string }>> {
  const a = await access(slug); if (!a.ok) return { success: false, error: a.error };
  const start = new Date(periodStart), end = new Date(periodEnd);
  if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime()) || end < start) return { success: false, error: "Enter a valid payroll period." };
  const days = (end.getTime() - start.getTime()) / 86_400_000 + 1;
  if (days > 31) return { success: false, error: "Payroll runs cover one month at most." };
  const clash = await prisma.hrPayrollRun.findFirst({ where: { storeId: a.store.id, status: { not: "VOID" }, periodStart: { lte: end }, periodEnd: { gte: start } } });
  if (clash) return { success: false, error: "A payroll run already exists for this period. Void it first if you need to redo it." };

  const employees = await prisma.hrEmployee.findMany({
    where: { storeId: a.store.id, status: { in: ["ACTIVE", "ON_LEAVE"] } },
    select: { id: true, basicSalary: true, housingAllowance: true, transportAllowance: true, otherAllowance: true, annualRent: true },
  });
  if (!employees.length) return { success: false, error: "Add active employees before running payroll." };

  const applyStatutory = opts.applyStatutory !== false;
  const run = await prisma.$transaction(async (tx) => {
    const created = await tx.hrPayrollRun.create({ data: { storeId: a.store.id, periodStart: start, periodEnd: end } });
    let gross = 0, deductions = 0, net = 0;
    for (const e of employees) {
      const p = computeMonthlyPayroll(
        { basic: money(e.basicSalary), housing: money(e.housingAllowance), transport: money(e.transportAllowance), other: money(e.otherAllowance), annualRent: money(e.annualRent) },
        { applyStatutory, applyNhf: !!opts.applyNhf },
      );
      gross += p.gross; deductions += p.deductions; net += p.net;
      await tx.hrPayrollItem.create({
        data: {
          payrollRunId: created.id, employeeId: e.id,
          basic: money(e.basicSalary), allowances: p.gross - money(e.basicSalary),
          deductions: p.deductions, gross: p.gross, net: p.net,
          note: applyStatutory ? `Pension ${p.pension} | NHF ${p.nhf} | PAYE ${p.paye}` : "No statutory deductions applied",
        },
      });
    }
    return tx.hrPayrollRun.update({ where: { id: created.id }, data: { totalGross: gross, totalDeductions: deductions, totalNet: net } });
  });
  return { success: true, data: { id: run.id } };
}

const NEXT_STATUS: Record<string, string[]> = { DRAFT: ["APPROVED", "VOID"], APPROVED: ["PAID", "VOID"], PAID: [], VOID: [] };

export async function updateHrPayrollStatus(slug: string, id: string, status: "APPROVED" | "PAID" | "VOID"): Promise<ActionResult<void>> {
  const a = await access(slug); if (!a.ok) return { success: false, error: a.error };
  const run = await prisma.hrPayrollRun.findFirst({ where: { id, storeId: a.store.id } });
  if (!run) return { success: false, error: "Payroll run not found." };
  if (!NEXT_STATUS[run.status]?.includes(status)) return { success: false, error: `A ${run.status.toLowerCase()} payroll run can't be marked ${status.toLowerCase()}.` };
  await prisma.hrPayrollRun.update({ where: { id }, data: { status, payDate: status === "PAID" ? new Date() : run.payDate } });
  return { success: true, data: undefined };
}
