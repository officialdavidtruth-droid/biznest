import { prisma } from "@/lib/prisma";
import { deductionBreakdown, type PayslipData } from "@/lib/hr/payslip";

/** Loads everything a payslip shows for one payroll item. Callers must check access first. */
export async function buildPayslipData(itemId: string): Promise<PayslipData | null> {
  const item = await prisma.hrPayrollItem.findUnique({
    where: { id: itemId },
    include: { employee: true, payrollRun: { include: { store: { select: { name: true } } } } },
  });
  if (!item) return null;
  const d = deductionBreakdown(item);
  const e = item.employee;
  return {
    storeName: item.payrollRun.store.name,
    employee: {
      name: `${e.firstName} ${e.lastName}`, employeeNo: e.employeeNo, position: e.position, department: e.department,
      bankName: e.bankName, accountNumber: e.accountNumber,
    },
    periodStart: item.payrollRun.periodStart, periodEnd: item.payrollRun.periodEnd, payDate: item.payrollRun.payDate,
    status: item.payrollRun.status,
    basic: Number(item.basic), allowances: Number(item.allowances),
    pension: d.pension, nhf: d.nhf, paye: d.paye, otherDeductions: d.other,
    gross: Number(item.gross), deductions: Number(item.deductions), net: Number(item.net),
  };
}
