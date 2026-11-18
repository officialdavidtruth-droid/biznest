/**
 * Plan billing periods. A plan is priced per month (Subscription.price); paying for a whole year
 * up front takes YEARLY_DISCOUNT off twelve months. This is the single source of truth for that
 * arithmetic: checkout, settlement, reminders, the landing page and the dashboard all use it, so
 * what a vendor sees is exactly what is charged and what is granted.
 */
export type BillingPeriod = "MONTHLY" | "YEARLY";

/** 15% off when a plan is paid for 12 months at once. */
export const YEARLY_DISCOUNT = 0.15;

export function normalizePeriod(value: unknown): BillingPeriod {
  return value === "YEARLY" ? "YEARLY" : "MONTHLY";
}

/** Whole naira, so the gateway is always asked for a clean amount. */
export function yearlyPriceFor(monthly: number): number {
  return Math.round(monthly * 12 * (1 - YEARLY_DISCOUNT));
}

export function priceFor(monthly: number, period: BillingPeriod): number {
  return period === "YEARLY" ? yearlyPriceFor(monthly) : Math.round(monthly);
}

/** What twelve separate monthly payments would have cost. */
export function twelveMonthsAtMonthly(monthly: number): number {
  return Math.round(monthly) * 12;
}

export function yearlySavingsFor(monthly: number): number {
  return twelveMonthsAtMonthly(monthly) - yearlyPriceFor(monthly);
}

/** The yearly price spread over 12 months, for "₦8,500/mo, billed yearly". */
export function effectiveMonthlyFor(monthly: number, period: BillingPeriod): number {
  return period === "YEARLY" ? Math.round(yearlyPriceFor(monthly) / 12) : Math.round(monthly);
}

export function monthsIn(period: BillingPeriod): number {
  return period === "YEARLY" ? 12 : 1;
}

/** The date a payment made now (or on top of an unexpired plan) keeps the plan running until. */
export function addPeriod(from: Date, period: BillingPeriod): Date {
  const next = new Date(from);
  const day = next.getDate();
  next.setMonth(next.getMonth() + monthsIn(period));
  // Jan 31 + 1 month must land on the last day of Feb, not roll into March.
  if (next.getDate() !== day) next.setDate(0);
  return next;
}

/**
 * Plan payment references are SUBUP-{storeId}-{planToken}-{random}. The random part's first
 * character records the period the charge was created for ("y" yearly, "m" monthly), so the
 * settlement code knows what was bought without a new table. See subscription-reference.ts.
 */
export function periodFlag(period: BillingPeriod): "y" | "m" {
  return period === "YEARLY" ? "y" : "m";
}

/**
 * The period a verified plan payment actually bought. Yearly only when the reference says so AND
 * the amount the charge was created for is the yearly price; a monthly-priced charge can therefore
 * never be turned into a year of access by editing a reference or callback URL.
 */
export function paidPeriod(reference: string, expectedAmountNaira: number, monthlyPrice: number): BillingPeriod {
  const randomPart = reference.split("-")[3] ?? "";
  if (randomPart[0] !== "y") return "MONTHLY";
  return Math.abs(expectedAmountNaira - yearlyPriceFor(monthlyPrice)) <= 0.01 ? "YEARLY" : "MONTHLY";
}
