import { describe, expect, it } from "vitest";
import { annualTax, computeMonthlyPayroll } from "@/lib/hr/nigeria-payroll";

describe("annualTax (NTA 2025 bands)", () => {
  it("is zero up to NGN 800,000", () => {
    expect(annualTax(800_000)).toBe(0);
  });
  it("applies bands progressively", () => {
    // 23,988,000: 0 + 330,000 + 1,620,000 + 11,988,000 * 21%
    expect(annualTax(23_988_000)).toBeCloseTo(4_467_480, 2);
  });
});

describe("computeMonthlyPayroll", () => {
  it("charges no PAYE on a low salary", () => {
    const r = computeMonthlyPayroll({ basic: 70_000, housing: 0, transport: 0, other: 0 }, { applyStatutory: true });
    expect(r.pension).toBe(5_600);
    expect(r.paye).toBe(0);
    expect(r.net).toBe(64_400);
  });

  it("matches a worked example with NHF and rent relief", () => {
    // Gross 100k; pension 5,600; NHF 875; rent relief 100k => chargeable 1,022,300/yr
    const r = computeMonthlyPayroll(
      { basic: 35_000, housing: 20_000, transport: 15_000, other: 30_000, annualRent: 500_000 },
      { applyStatutory: true, applyNhf: true },
    );
    expect(r.pension).toBe(5_600);
    expect(r.nhf).toBe(875);
    expect(r.paye).toBeCloseTo(2_778.75, 2);
    expect(r.net).toBeCloseTo(100_000 - 5_600 - 875 - 2_778.75, 2);
  });

  it("caps rent relief at NGN 500,000", () => {
    const a = computeMonthlyPayroll({ basic: 2_200_000, housing: 0, transport: 0, other: 0, annualRent: 2_500_000 }, { applyStatutory: true });
    const b = computeMonthlyPayroll({ basic: 2_200_000, housing: 0, transport: 0, other: 0, annualRent: 10_000_000 }, { applyStatutory: true });
    expect(a.paye).toBe(b.paye);
  });

  it("deducts nothing when statutory deductions are off", () => {
    const r = computeMonthlyPayroll({ basic: 300_000, housing: 0, transport: 0, other: 0 }, { applyStatutory: false });
    expect(r.deductions).toBe(0);
    expect(r.net).toBe(300_000);
  });
});
