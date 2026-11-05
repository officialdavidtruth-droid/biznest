/**
 * Pure helpers for real-estate rent collection. No database or Next.js imports so they are easy to test.
 */
import { reminderKind, type ReminderKind } from "@/lib/travel-growth";

/** Gateway references for a rent payment: RNT-<chargeId>-<token>. */
export const RENT_PAY_PREFIX = "RNT";

/** Cheapest online payment worth taking (gateways reject tiny charges). */
export const RENT_MIN_ONLINE_PAYMENT = 100;

export const RENT_CYCLES = ["MONTHLY", "QUARTERLY", "BIANNUAL", "ANNUAL"] as const;
export type RentCycle = (typeof RENT_CYCLES)[number];

export const RENT_CYCLE_LABEL: Record<RentCycle, string> = {
  MONTHLY: "Monthly", QUARTERLY: "Quarterly", BIANNUAL: "Every 6 months", ANNUAL: "Yearly",
};

const CYCLE_MONTHS: Record<RentCycle, number> = { MONTHLY: 1, QUARTERLY: 3, BIANNUAL: 6, ANNUAL: 12 };

export const RENT_PAYMENT_METHODS = ["CASH", "TRANSFER", "CARD", "POS", "OTHER"] as const;
export const MAINTENANCE_STATUSES = ["OPEN", "IN_PROGRESS", "DONE", "CANCELLED"] as const;
export const MAINTENANCE_PRIORITIES = ["LOW", "NORMAL", "URGENT"] as const;

export function isRentCycle(v: unknown): v is RentCycle {
  return typeof v === "string" && (RENT_CYCLES as readonly string[]).includes(v);
}

/** Money to two decimals. NaN when the input is not a finite number. */
export function money(v: unknown): number {
  const n = typeof v === "string" ? Number(v.replace(/,/g, "")) : Number(v);
  return Number.isFinite(n) ? Math.round(n * 100) / 100 : NaN;
}

/** Adds whole months in UTC, clamping to the last day (31 Jan + 1 month = 28/29 Feb, never 3 Mar). */
export function addMonthsUtc(d: Date, months: number): Date {
  const out = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), 1, d.getUTCHours(), d.getUTCMinutes(), d.getUTCSeconds()));
  out.setUTCMonth(out.getUTCMonth() + months);
  const lastDay = new Date(Date.UTC(out.getUTCFullYear(), out.getUTCMonth() + 1, 0)).getUTCDate();
  out.setUTCDate(Math.min(d.getUTCDate(), lastDay));
  return out;
}

const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

/** "Jan 2027" or "Jan to Mar 2027" style label for the period starting at `start`. */
export function periodLabel(start: Date, cycle: RentCycle): string {
  const months = CYCLE_MONTHS[cycle];
  if (months === 1) return `${MONTHS[start.getUTCMonth()]} ${start.getUTCFullYear()}`;
  const end = addMonthsUtc(start, months - 1);
  if (months === 12) return `${MONTHS[start.getUTCMonth()]} ${start.getUTCFullYear()} to ${MONTHS[end.getUTCMonth()]} ${end.getUTCFullYear()}`;
  return start.getUTCFullYear() === end.getUTCFullYear()
    ? `${MONTHS[start.getUTCMonth()]} to ${MONTHS[end.getUTCMonth()]} ${end.getUTCFullYear()}`
    : `${MONTHS[start.getUTCMonth()]} ${start.getUTCFullYear()} to ${MONTHS[end.getUTCMonth()]} ${end.getUTCFullYear()}`;
}

export const MAX_SCHEDULE_PERIODS = 60;

/**
 * The rent periods to bill, starting at `start`, one per cycle. `rentAmount` is the amount for ONE PERIOD.
 * Stops at `leaseEnd` when given (a period must start before the lease ends). Always at least one, at most 60.
 */
export function buildRentSchedule(input: { start: Date; cycle: RentCycle; periods?: number; leaseEnd?: Date | null }): { label: string; dueDate: Date }[] {
  const step = CYCLE_MONTHS[input.cycle];
  const wanted = Number.isFinite(input.periods) ? Math.floor(input.periods as number) : 1;
  const cap = Math.min(Math.max(wanted, 1), MAX_SCHEDULE_PERIODS);
  const out: { label: string; dueDate: Date }[] = [];
  for (let i = 0; i < cap; i++) {
    const due = addMonthsUtc(input.start, i * step);
    if (i > 0 && input.leaseEnd && due.getTime() >= input.leaseEnd.getTime()) break;
    out.push({ label: periodLabel(due, input.cycle), dueDate: due });
  }
  return out;
}

export type ChargeLike = { status: string; dueDate: Date | string; amount: number | string | { toString(): string } };
export type ChargeState = "PAID" | "VOID" | "OVERDUE" | "DUE_SOON" | "UPCOMING";

/** Where a charge stands today. "Due soon" is within 7 days. */
export function chargeState(c: ChargeLike, now: Date = new Date()): ChargeState {
  if (c.status === "PAID") return "PAID";
  if (c.status === "VOID") return "VOID";
  const due = new Date(c.dueDate).getTime();
  if (due < startOfUtcDay(now)) return "OVERDUE";
  if (due <= now.getTime() + 7 * 86_400_000) return "DUE_SOON";
  return "UPCOMING";
}

function startOfUtcDay(d: Date): number {
  return Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate());
}

export type RentSummary = { outstanding: number; overdue: number; paid: number; overdueCount: number; nextDue: Date | null };

/** Totals across a unit's (or portfolio's) charges. Void charges are ignored. */
export function summariseCharges(charges: ChargeLike[], now: Date = new Date()): RentSummary {
  let outstanding = 0, overdue = 0, paid = 0, overdueCount = 0;
  let nextDue: Date | null = null;
  for (const c of charges) {
    const amt = Number(c.amount);
    const st = chargeState(c, now);
    if (st === "VOID") continue;
    if (st === "PAID") { paid += amt; continue; }
    outstanding += amt;
    if (st === "OVERDUE") { overdue += amt; overdueCount += 1; }
    const d = new Date(c.dueDate);
    if (!nextDue || d.getTime() < nextDue.getTime()) nextDue = d;
  }
  const r = (n: number) => Math.round(n * 100) / 100;
  return { outstanding: r(outstanding), overdue: r(overdue), paid: r(paid), overdueCount, nextDue };
}

/** Sequential per-store receipt number, e.g. RCT-000042. */
export function receiptNumber(seq: number): string {
  return `RCT-${String(Math.max(1, Math.floor(seq))).padStart(6, "0")}`;
}

/** Highest sequence among existing receipt numbers (0 when none). Ignores anything that is not RCT-<digits>. */
export function lastReceiptSeq(receiptNos: (string | null | undefined)[]): number {
  let max = 0;
  for (const r of receiptNos) {
    const m = /^RCT-(\d{1,9})$/.exec(r ?? "");
    if (m) max = Math.max(max, Number(m[1]));
  }
  return max;
}

/** Which rent reminder (if any) is due: same cadence as travel instalments (3 days before, on the day, weekly overdue, max 4). */
export function rentReminderKind(c: { dueDate: Date | null; reminderCount: number; lastReminderAt: Date | null }, now: Date = new Date()): ReminderKind | null {
  return reminderKind(c, now);
}

export type TenantInput = { name?: unknown; email?: unknown; phone?: unknown };
export type CleanTenant = { name: string; email: string | null; phone: string | null };

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

/** Validates tenant contact details. Name is required; email and phone are optional but must look right when given. */
export function sanitizeTenant(input: TenantInput): { ok: true; tenant: CleanTenant } | { ok: false; error: string } {
  const name = String(input.name ?? "").replace(/\s+/g, " ").trim().slice(0, 120);
  if (!name) return { ok: false, error: "Enter the tenant's name." };
  const emailRaw = String(input.email ?? "").trim().toLowerCase();
  if (emailRaw && (emailRaw.length > 160 || !EMAIL_RE.test(emailRaw))) return { ok: false, error: "That email address doesn't look right." };
  const phoneRaw = String(input.phone ?? "").trim();
  const digits = phoneRaw.replace(/[^\d]/g, "");
  if (phoneRaw && (digits.length < 7 || digits.length > 15)) return { ok: false, error: "That phone number doesn't look right." };
  return { ok: true, tenant: { name, email: emailRaw || null, phone: phoneRaw ? phoneRaw.replace(/[^\d+]/g, "").slice(0, 20) : null } };
}

export function newPortalToken(): string {
  // 24 url-safe chars from the platform CSPRNG; the link is the tenant's only credential.
  const bytes = new Uint8Array(18);
  globalThis.crypto.getRandomValues(bytes);
  return Buffer.from(bytes).toString("base64url");
}

export function rentPortalPath(slug: string, token: string): string {
  return `/store/${slug}/rent/${token}`;
}
