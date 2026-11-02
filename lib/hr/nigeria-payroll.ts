/**
 * Nigerian monthly payroll maths (Nigeria Tax Act 2025, in force from 1 Jan 2026).
 *
 * - PAYE is computed on an annual basis with the six progressive bands, then
 *   divided by 12. The old Consolidated Relief Allowance no longer exists.
 * - Employee pension is 8% of basic + housing + transport (Pension Reform Act 2014).
 *   It is deductible before PAYE.
 * - NHF is 2.5% of basic. It is voluntary for private-sector employees, so it is opt-in.
 * - Rent relief is 20% of annual rent paid, capped at NGN 500,000.
 *
 * Pure functions only (no I/O) so they are easy to test and to update when the rules change.
 */

export const PAYE_BANDS_2026 = [
  { upTo: 800_000, rate: 0 },
  { upTo: 3_000_000, rate: 0.15 },
  { upTo: 12_000_000, rate: 0.18 },
  { upTo: 25_000_000, rate: 0.21 },
  { upTo: 50_000_000, rate: 0.23 },
  { upTo: Infinity, rate: 0.25 },
] as const;

export const PENSION_EMPLOYEE_RATE = 0.08;
export const NHF_RATE = 0.025;
export const RENT_RELIEF_RATE = 0.2;
export const RENT_RELIEF_CAP = 500_000;

const r2 = (n: number) => Math.round((n + Number.EPSILON) * 100) / 100;

export type PayrollInput = {
  basic: number;
  housing: number;
  transport: number;
  other: number;
  /** Annual rent the employee pays; used for rent relief. 0 = no claim. */
  annualRent?: number;
};

export type PayrollOptions = {
  /** Deduct employee pension and PAYE. */
  applyStatutory: boolean;
  /** Also deduct NHF (voluntary for private employers). */
  applyNhf?: boolean;
};

export type PayrollResult = {
  gross: number;
  pension: number;
  nhf: number;
  paye: number;
  deductions: number;
  net: number;
};

/** Progressive annual tax on a chargeable income. */
export function annualTax(chargeable: number): number {
  let remaining = Math.max(0, chargeable);
  let lower = 0;
  let tax = 0;
  for (const band of PAYE_BANDS_2026) {
    if (remaining <= 0) break;
    const width = band.upTo === Infinity ? remaining : Math.min(remaining, band.upTo - lower);
    tax += width * band.rate;
    remaining -= width;
    lower = band.upTo;
  }
  return tax;
}

export function computeMonthlyPayroll(input: PayrollInput, opts: PayrollOptions): PayrollResult {
  const basic = Math.max(0, input.basic);
  const housing = Math.max(0, input.housing);
  const transport = Math.max(0, input.transport);
  const other = Math.max(0, input.other);
  const gross = basic + housing + transport + other;

  if (!opts.applyStatutory) {
    return { gross: r2(gross), pension: 0, nhf: 0, paye: 0, deductions: 0, net: r2(gross) };
  }

  const pension = r2((basic + housing + transport) * PENSION_EMPLOYEE_RATE);
  const nhf = opts.applyNhf ? r2(basic * NHF_RATE) : 0;
  const rentRelief = Math.min(RENT_RELIEF_CAP, Math.max(0, input.annualRent ?? 0) * RENT_RELIEF_RATE);
  const chargeable = Math.max(0, gross * 12 - (pension + nhf) * 12 - rentRelief);
  const paye = r2(annualTax(chargeable) / 12);
  const deductions = r2(pension + nhf + paye);
  return { gross: r2(gross), pension, nhf, paye, deductions, net: r2(gross - deductions) };
}
