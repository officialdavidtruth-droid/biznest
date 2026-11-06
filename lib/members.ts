/**
 * Pure helpers for members and billing: church members and giving, salon clients and packages, gym memberships.
 * No database or Next.js imports so they are easy to test.
 */
import { addMonthsUtc, money, newPortalToken, lastReceiptSeq, receiptNumber, sanitizeTenant, summariseCharges, chargeState } from "@/lib/real-estate";
import { reminderKind, type ReminderKind } from "@/lib/travel-growth";

export { money, newPortalToken, lastReceiptSeq, receiptNumber, summariseCharges, chargeState };

/** Gateway references for a member payment: MBR-<chargeId>-<token>. */
export const MEMBER_PAY_PREFIX = "MBR";

/** Cheapest online payment worth taking (gateways reject tiny charges). */
export const MEMBER_MIN_ONLINE_PAYMENT = 100;
/** Largest single online gift or payment accepted from the public page. */
export const MEMBER_MAX_ONLINE_PAYMENT = 10_000_000;

export const PLAN_KINDS = ["MEMBERSHIP", "PACKAGE", "FUND"] as const;
export type PlanKind = (typeof PLAN_KINDS)[number];
export const PLAN_INTERVALS = ["WEEKLY", "MONTHLY", "QUARTERLY", "ANNUAL", "ONCE"] as const;
export type PlanInterval = (typeof PLAN_INTERVALS)[number];
export const INTERVAL_LABEL: Record<PlanInterval, string> = { WEEKLY: "Weekly", MONTHLY: "Monthly", QUARTERLY: "Every 3 months", ANNUAL: "Yearly", ONCE: "One-off" };
export const MEMBER_PAYMENT_METHODS = ["CASH", "TRANSFER", "CARD", "POS", "OTHER"] as const;
export const MEMBERSHIP_STATUSES = ["ACTIVE", "PAUSED", "CANCELLED"] as const;

export const isPlanKind = (v: unknown): v is PlanKind => typeof v === "string" && (PLAN_KINDS as readonly string[]).includes(v);
export const isPlanInterval = (v: unknown): v is PlanInterval => typeof v === "string" && (PLAN_INTERVALS as readonly string[]).includes(v);

/** What each kind of business calls things, and which parts of the workspace it gets. */
export type MembersProfile = {
  key: "church" | "salon" | "fitness" | "generic";
  memberLabel: string; membersLabel: string; planLabel: string; plansLabel: string;
  checkInLabel: string; giving: boolean; packages: boolean; memberships: boolean;
};

export function membersProfile(businessType: string | null | undefined): MembersProfile {
  const t = (businessType ?? "").toLowerCase();
  if (/church|ministry|mosque|worship|parish|fellowship/.test(t)) {
    return { key: "church", memberLabel: "Member", membersLabel: "Members", planLabel: "Giving fund", plansLabel: "Giving funds", checkInLabel: "Attendance", giving: true, packages: false, memberships: false };
  }
  if (/salon|beauty|barber|spa|nail|makeup|hair/.test(t)) {
    return { key: "salon", memberLabel: "Client", membersLabel: "Clients", planLabel: "Package", plansLabel: "Packages and memberships", checkInLabel: "Visits", giving: false, packages: true, memberships: true };
  }
  if (/fitness|gym|yoga|pilates|crossfit|sport/.test(t)) {
    return { key: "fitness", memberLabel: "Member", membersLabel: "Members", planLabel: "Plan", plansLabel: "Plans and class packs", checkInLabel: "Check-ins", giving: false, packages: true, memberships: true };
  }
  return { key: "generic", memberLabel: "Member", membersLabel: "Members", planLabel: "Plan", plansLabel: "Plans", checkInLabel: "Visits", giving: false, packages: true, memberships: true };
}

const DAY_MS = 86_400_000;

/** The date after `from` when the next payment is due. ONCE has none. */
export function nextRenewal(from: Date, interval: PlanInterval): Date | null {
  switch (interval) {
    case "WEEKLY": return new Date(from.getTime() + 7 * DAY_MS);
    case "MONTHLY": return addMonthsUtc(from, 1);
    case "QUARTERLY": return addMonthsUtc(from, 3);
    case "ANNUAL": return addMonthsUtc(from, 12);
    default: return null;
  }
}

const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

/** "Nov 2026" for monthly-ish plans, "week of 6 Nov" for weekly ones. */
export function periodText(start: Date, interval: PlanInterval): string {
  if (interval === "WEEKLY") return `week of ${start.getUTCDate()} ${MONTHS[start.getUTCMonth()]}`;
  if (interval === "ONCE") return `${start.getUTCDate()} ${MONTHS[start.getUTCMonth()]} ${start.getUTCFullYear()}`;
  return `${MONTHS[start.getUTCMonth()]} ${start.getUTCFullYear()}`;
}

export type PlanLike = { id?: string; name: string; kind: string; price: number | string; interval: string; sessions?: number | null; validityDays?: number | null };

/** Everything that follows from putting someone on a plan: dates, sessions and the first charge. */
export function buildEnrollment(plan: PlanLike, startsAt: Date): {
  renewsAt: Date | null; endsAt: Date | null; sessionsLeft: number | null;
  firstCharge: { label: string; amount: number; dueDate: Date; kind: "DUES" | "PACKAGE" };
} {
  const interval: PlanInterval = isPlanInterval(plan.interval) ? plan.interval : "MONTHLY";
  const amount = Math.max(0, money(plan.price) || 0);
  if (plan.kind === "PACKAGE") {
    const sessions = Number.isFinite(plan.sessions) && (plan.sessions as number) > 0 ? Math.floor(plan.sessions as number) : null;
    const days = Number.isFinite(plan.validityDays) && (plan.validityDays as number) > 0 ? Math.floor(plan.validityDays as number) : null;
    return {
      renewsAt: null, sessionsLeft: sessions,
      endsAt: days ? new Date(startsAt.getTime() + days * DAY_MS) : null,
      firstCharge: { label: `${plan.name}${sessions ? ` (${sessions} sessions)` : ""}`, amount, dueDate: startsAt, kind: "PACKAGE" },
    };
  }
  return {
    renewsAt: nextRenewal(startsAt, interval), endsAt: null, sessionsLeft: null,
    firstCharge: { label: `${plan.name}: ${periodText(startsAt, interval)}`, amount, dueDate: startsAt, kind: "DUES" },
  };
}

export type MembershipLike = {
  status: string; startsAt: Date | string; renewsAt?: Date | string | null; endsAt?: Date | string | null; sessionsLeft?: number | null;
};
export type MembershipState = "ACTIVE" | "EXPIRING" | "EXPIRED" | "USED_UP" | "PAUSED" | "CANCELLED" | "NOT_STARTED";

/** Where a membership stands today. "Expiring" is within 7 days of its end date. */
export function membershipState(m: MembershipLike, now: Date = new Date()): MembershipState {
  if (m.status === "CANCELLED") return "CANCELLED";
  if (m.status === "PAUSED") return "PAUSED";
  if (new Date(m.startsAt).getTime() > now.getTime()) return "NOT_STARTED";
  if (m.endsAt && new Date(m.endsAt).getTime() < now.getTime()) return "EXPIRED";
  if (m.sessionsLeft !== null && m.sessionsLeft !== undefined && m.sessionsLeft <= 0) return "USED_UP";
  if (m.endsAt && new Date(m.endsAt).getTime() - now.getTime() <= 7 * DAY_MS) return "EXPIRING";
  return "ACTIVE";
}

/**
 * Whether a check-in can go ahead. Dues that are overdue block it unless staff force it.
 * Returns the number of sessions to deduct (0 for an unlimited membership).
 */
export function checkInDecision(
  m: MembershipLike, overdueDues: boolean, now: Date = new Date(), force = false
): { ok: true; useSession: boolean } | { ok: false; reason: string } {
  const state = membershipState(m, now);
  if (state === "CANCELLED") return { ok: false, reason: "This membership was cancelled." };
  if (state === "PAUSED") return { ok: false, reason: "This membership is paused." };
  if (state === "NOT_STARTED") return { ok: false, reason: "This membership hasn't started yet." };
  if (state === "EXPIRED") return { ok: false, reason: "This membership has expired." };
  if (state === "USED_UP") return { ok: false, reason: "No sessions left." };
  if (overdueDues && !force) return { ok: false, reason: "Dues are overdue. Collect payment first, or check in anyway." };
  return { ok: true, useSession: m.sessionsLeft !== null && m.sessionsLeft !== undefined };
}

/** True when the next period's charge should be created now: renewing within `leadDays` and not yet billed. */
export function renewalDue(m: MembershipLike, now: Date = new Date(), leadDays = 7): boolean {
  if (m.status !== "ACTIVE" || !m.renewsAt) return false;
  if (m.endsAt && new Date(m.endsAt).getTime() < now.getTime()) return false;
  return new Date(m.renewsAt).getTime() <= now.getTime() + leadDays * DAY_MS;
}

export function memberReminderKind(c: { dueDate: Date | null; reminderCount: number; lastReminderAt: Date | null }, now: Date = new Date()): ReminderKind | null {
  return reminderKind(c, now);
}

export type CleanMember = { name: string; email: string | null; phone: string | null };

/** Validates a member's contact details. Name is required; email and phone are optional but must look right. */
export function sanitizeMember(input: { name?: unknown; email?: unknown; phone?: unknown }): { ok: true; member: CleanMember } | { ok: false; error: string } {
  const r = sanitizeTenant({ name: input.name, email: input.email, phone: input.phone });
  if (!r.ok) return { ok: false, error: r.error.replace("the tenant's", "the") };
  return { ok: true, member: r.tenant };
}

export type CleanGift = { fund: string; amount: number; name: string | null; email: string | null };
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

/** Validates a gift typed into the public giving page. Amount is bounded; name and email are optional. */
export function sanitizeGift(input: { fund?: unknown; amount?: unknown; name?: unknown; email?: unknown }): { ok: true; gift: CleanGift } | { ok: false; error: string } {
  const fund = String(input.fund ?? "").trim().slice(0, 80);
  if (!fund) return { ok: false, error: "Choose what you are giving to." };
  const amount = money(input.amount);
  if (!Number.isFinite(amount) || amount < MEMBER_MIN_ONLINE_PAYMENT) return { ok: false, error: `The smallest gift online is ${MEMBER_MIN_ONLINE_PAYMENT}.` };
  if (amount > MEMBER_MAX_ONLINE_PAYMENT) return { ok: false, error: "That amount is too large to give online. Please speak to the office." };
  const name = String(input.name ?? "").replace(/\s+/g, " ").trim().slice(0, 120);
  const email = String(input.email ?? "").trim().toLowerCase();
  if (email && (email.length > 160 || !EMAIL_RE.test(email))) return { ok: false, error: "That email address doesn't look right." };
  return { ok: true, gift: { fund, amount, name: name || null, email: email || null } };
}

export type GivingRow = { fund: string | null; amount: number | string; paidAt: Date | string | null };

/** Totals of PAID gifts: overall, per fund, and per month (newest first, "2026-11"). */
export function givingSummary(rows: GivingRow[]): { total: number; count: number; byFund: { fund: string; total: number; count: number }[]; byMonth: { month: string; total: number }[] } {
  const funds = new Map<string, { total: number; count: number }>();
  const months = new Map<string, number>();
  let total = 0, count = 0;
  for (const r of rows) {
    const amt = Number(r.amount);
    if (!Number.isFinite(amt) || amt <= 0) continue;
    total += amt; count += 1;
    const fund = r.fund?.trim() || "General";
    const f = funds.get(fund) ?? { total: 0, count: 0 };
    f.total += amt; f.count += 1; funds.set(fund, f);
    if (r.paidAt) {
      const d = new Date(r.paidAt);
      const key = `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, "0")}`;
      months.set(key, (months.get(key) ?? 0) + amt);
    }
  }
  const r2 = (n: number) => Math.round(n * 100) / 100;
  return {
    total: r2(total), count,
    byFund: [...funds.entries()].map(([fund, v]) => ({ fund, total: r2(v.total), count: v.count })).sort((a, b) => b.total - a.total),
    byMonth: [...months.entries()].map(([month, t]) => ({ month, total: r2(t) })).sort((a, b) => (a.month < b.month ? 1 : -1)),
  };
}

export const memberPortalPath = (slug: string, token: string) => `/store/${slug}/member/${token}`;
export const givingPath = (slug: string) => `/store/${slug}/give`;
