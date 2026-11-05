// Pure helpers for the BizNest Travel growth features: instalment plans and reminders, per-date departures,
// supplier costs in another currency, receivables aging and calendar (.ics) files.
// No server-only imports, so the dashboard, the public pages, the cron job and the tests can all use them.

const r2 = (n: number) => Math.round(n * 100) / 100;

// ---------------------------------------------------------------- instalment plans

export type InstalmentInput = { balance: number; count: number; firstDue: Date; intervalDays: number };
export type Instalment = { amount: number; dueDate: Date };

/**
 * Splits an outstanding balance into equal instalments. Whole currency units are used for every instalment but
 * the last, which absorbs the remainder, so the schedule always adds up to exactly the balance.
 */
export function instalmentSchedule({ balance, count, firstDue, intervalDays }: InstalmentInput): Instalment[] {
  const total = r2(Number(balance));
  const n = Math.floor(Number(count));
  const gap = Math.floor(Number(intervalDays));
  if (!(total > 0) || !Number.isFinite(n) || n < 1 || n > 24 || !Number.isFinite(gap) || gap < 1 || gap > 365) return [];
  if (Number.isNaN(firstDue.getTime())) return [];
  const base = Math.floor(total / n);
  const out: Instalment[] = [];
  let used = 0;
  for (let i = 0; i < n; i++) {
    const amount = i === n - 1 ? r2(total - used) : base;
    used = r2(used + amount);
    out.push({ amount, dueDate: new Date(firstDue.getTime() + i * gap * 86_400_000) });
  }
  return out.filter((x) => x.amount > 0);
}

export type DueRow = { id: string; amount: number; dueDate: Date | null };
export type DueAllocation = { id: string; action: "settle" | "reduce"; newAmount: number };

/**
 * When money arrives online, it pays off the oldest DUE instalments first. A fully covered instalment is settled
 * (closed), a partly covered one is reduced to what is still owed. Returns what to change; anything left over
 * simply counts as a normal payment.
 */
export function allocateAgainstDue(dues: DueRow[], paid: number): DueAllocation[] {
  let left = r2(Number(paid));
  if (!(left > 0)) return [];
  const ordered = [...dues].sort((a, b) => (a.dueDate?.getTime() ?? Infinity) - (b.dueDate?.getTime() ?? Infinity));
  const out: DueAllocation[] = [];
  for (const d of ordered) {
    if (left <= 0.004) break;
    const amt = r2(Number(d.amount));
    if (!(amt > 0)) continue;
    if (left >= amt - 0.004) { out.push({ id: d.id, action: "settle", newAmount: 0 }); left = r2(left - amt); }
    else { out.push({ id: d.id, action: "reduce", newAmount: r2(amt - left) }); left = 0; }
  }
  return out;
}

export type ReminderKind = "upcoming" | "due" | "overdue";
export const MAX_REMINDERS = 4;

/**
 * Should this instalment get a reminder email today? Reminders go out 3 days before, on the day, and then
 * weekly while overdue, never more than MAX_REMINDERS in total and never twice in 5 days.
 */
export function reminderKind(due: { dueDate: Date | null; reminderCount: number; lastReminderAt: Date | null }, now: Date): ReminderKind | null {
  if (!due.dueDate) return null;
  if (due.reminderCount >= MAX_REMINDERS) return null;
  if (due.lastReminderAt && now.getTime() - due.lastReminderAt.getTime() < 5 * 86_400_000) return null;
  const startOfDay = (d: Date) => Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate());
  const days = Math.round((startOfDay(due.dueDate) - startOfDay(now)) / 86_400_000);
  if (days < 0) return "overdue";
  if (days === 0) return "due";
  if (days <= 3) return due.reminderCount === 0 ? "upcoming" : null;
  return null;
}

// ---------------------------------------------------------------- supplier cost in another currency

/** Supplier price in their currency × the rate you entered = cost in the trip's currency. Null when either is not a positive number. */
export function convertCost(amount: unknown, rate: unknown): number | null {
  const a = Number(amount), r = Number(rate);
  if (!Number.isFinite(a) || !Number.isFinite(r) || a < 0 || !(r > 0)) return null;
  return r2(a * r);
}

// ---------------------------------------------------------------- per-date departures

export type SeatScope = { departureSeats: number; packageSeats: number };

/** Seats on one departure: its own count, or the package's when the departure leaves it at 0. 0 = unlimited. */
export function departureCapacity(s: SeatScope): number {
  return s.departureSeats > 0 ? s.departureSeats : s.packageSeats > 0 ? s.packageSeats : 0;
}

/** Online booking closes `cutoffDays` before departure. A departure with no date never closes. */
export function bookingClosedByCutoff(departureDate: Date | null, cutoffDays: number, now = new Date()): boolean {
  if (!departureDate) return false;
  const days = Math.max(0, Math.floor(Number(cutoffDays) || 0));
  return now.getTime() > departureDate.getTime() - days * 86_400_000;
}

export type DepartureOption = { id: string | null; date: Date | null };

/** Valid departure dates must be in the future and not duplicate one the package already has. */
export function departureDateError(date: Date | null, existing: Date[], now = new Date()): string | null {
  if (!date || Number.isNaN(date.getTime())) return "Choose a departure date.";
  if (date.getTime() < now.getTime() - 86_400_000) return "The departure date can't be in the past.";
  const day = date.toISOString().slice(0, 10);
  if (existing.some((d) => d.toISOString().slice(0, 10) === day)) return "This package already has a departure on that date.";
  return null;
}

// ---------------------------------------------------------------- receivables aging and profit

export type AgingBucket = "CURRENT" | "1-30" | "31-60" | "61-90" | "90+";
export const AGING_BUCKETS: AgingBucket[] = ["CURRENT", "1-30", "31-60", "61-90", "90+"];

/** Bucket for an instalment by how many whole days it is past its due date (or "CURRENT" when not yet due). */
export function agingBucket(dueDate: Date | null, now = new Date()): AgingBucket {
  if (!dueDate) return "CURRENT";
  const days = Math.floor((now.getTime() - dueDate.getTime()) / 86_400_000);
  if (days <= 0) return "CURRENT";
  if (days <= 30) return "1-30";
  if (days <= 60) return "31-60";
  if (days <= 90) return "61-90";
  return "90+";
}

export type ProfitRow = { price: number; cost: number; commission: number; paid: number };

/** Profit after supplier cost and agent commission, and the margin on the selling price. */
export function profitOf(r: ProfitRow): { profit: number; marginPct: number | null } {
  const profit = r2(r.price - r.cost - r.commission);
  return { profit, marginPct: r.price > 0 ? Math.round((profit / r.price) * 1000) / 10 : null };
}

// ---------------------------------------------------------------- calendar (.ics)

export type IcsEvent = { uid: string; start: Date; end?: Date | null; summary: string; description?: string | null; location?: string | null };

const icsEscape = (v: string) => v.replace(/\\/g, "\\\\").replace(/;/g, "\\;").replace(/,/g, "\\,").replace(/\r?\n/g, "\\n");
const icsDate = (d: Date) => d.toISOString().slice(0, 10).replace(/-/g, "");
const icsStamp = (d: Date) => d.toISOString().replace(/[-:]/g, "").replace(/\.\d{3}/, "");

/** RFC 5545 content lines must be folded at 75 octets; continuation lines start with one space. */
function fold(line: string): string {
  const bytes = Buffer.from(line, "utf8");
  if (bytes.length <= 75) return line;
  const parts: string[] = [];
  let i = 0, first = true;
  while (i < bytes.length) {
    const size = first ? 75 : 74;
    let end = Math.min(bytes.length, i + size);
    while (end < bytes.length && (bytes[end] & 0xc0) === 0x80) end--; // don't split a multi-byte character
    parts.push(bytes.subarray(i, end).toString("utf8"));
    i = end; first = false;
  }
  return parts.join("\r\n ");
}

/**
 * Builds an iCalendar file of all-day events. `end` is the last day of the event (inclusive); iCalendar wants the
 * day after, which this adds. Subscribing in Google/Apple/Outlook keeps it up to date as dates change.
 */
export function buildIcs(calendarName: string, events: IcsEvent[], now = new Date()): string {
  const lines = ["BEGIN:VCALENDAR", "VERSION:2.0", "PRODID:-//BizNest//Travel//EN", "CALSCALE:GREGORIAN", "METHOD:PUBLISH", `X-WR-CALNAME:${icsEscape(calendarName)}`];
  for (const e of events) {
    if (Number.isNaN(e.start.getTime())) continue;
    const last = e.end && !Number.isNaN(e.end.getTime()) && e.end >= e.start ? e.end : e.start;
    const exclusiveEnd = new Date(Date.UTC(last.getUTCFullYear(), last.getUTCMonth(), last.getUTCDate() + 1));
    lines.push("BEGIN:VEVENT", `UID:${e.uid}`, `DTSTAMP:${icsStamp(now)}`, `DTSTART;VALUE=DATE:${icsDate(e.start)}`, `DTEND;VALUE=DATE:${icsDate(exclusiveEnd)}`, `SUMMARY:${icsEscape(e.summary)}`);
    if (e.description) lines.push(`DESCRIPTION:${icsEscape(e.description)}`);
    if (e.location) lines.push(`LOCATION:${icsEscape(e.location)}`);
    lines.push("END:VEVENT");
  }
  lines.push("END:VCALENDAR");
  return lines.map(fold).join("\r\n") + "\r\n";
}
