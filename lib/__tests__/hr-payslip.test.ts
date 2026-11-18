import { describe, it, expect } from "vitest";
import { deductionBreakdown, renderPayslipPdf, payslipFileName } from "@/lib/hr/payslip";

describe("payslip", () => {
  it("uses the stored columns", () => {
    expect(deductionBreakdown({ basic: 0, allowances: 0, gross: 0, net: 0, deductions: 160, pension: 80, nhf: 20, paye: 60 })).toEqual({ pension: 80, nhf: 20, paye: 60, other: 0 });
  });
  it("falls back to the note for older runs", () => {
    expect(deductionBreakdown({ basic: 0, allowances: 0, gross: 0, net: 0, deductions: 100, note: "Pension 40 | NHF 10 | PAYE 50" })).toEqual({ pension: 40, nhf: 10, paye: 50, other: 0 });
  });
  it("puts any remainder in other", () => {
    expect(deductionBreakdown({ basic: 0, allowances: 0, gross: 0, net: 0, deductions: 120, pension: 40, nhf: 10, paye: 50 }).other).toBe(20);
  });
  it("renders a real PDF", async () => {
    const data = {
      storeName: "Demo Co", employee: { name: "Ada Obi", employeeNo: "E001", position: "Cashier", department: "Sales", bankName: "GTBank", accountNumber: "0123456789" },
      periodStart: new Date("2026-11-01T00:00:00Z"), periodEnd: new Date("2026-11-30T00:00:00Z"), payDate: null, status: "APPROVED",
      basic: 100000, allowances: 50000, pension: 8000, nhf: 0, paye: 4000, otherDeductions: 0, gross: 150000, deductions: 12000, net: 138000,
    };
    const bytes = await renderPayslipPdf(data);
    expect(Buffer.from(bytes.slice(0, 5)).toString()).toBe("%PDF-");
    expect(bytes.length).toBeGreaterThan(1500);
    expect(payslipFileName(data)).toBe("Payslip_Ada_Obi_2026-11.pdf");
  });
});
