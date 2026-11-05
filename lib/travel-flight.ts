// Structured flight details for a service line, plus the ticketing-deadline rules.
// Pure (no server imports) so the dashboard, the public trip page, the PDF builder and the cron job share one definition.

export type FlightTicket = { name: string; number: string };
export type Flight = {
  airline: string; flightNumber: string; origin: string; destination: string;
  /** Local airport time as typed, "YYYY-MM-DDTHH:mm". Airline times are local, so no time zone is attached. */
  departAt: string; arriveAt: string;
  pnr: string; cabin: string; baggage: string; tickets: FlightTicket[];
};

const clean = (v: unknown, max: number) => String(v ?? "").replace(/[\u0000-\u001f]/g, " ").replace(/\s+/g, " ").trim().slice(0, max);
const LOCAL_DT = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/;
export const emptyFlight = (): Flight => ({ airline: "", flightNumber: "", origin: "", destination: "", departAt: "", arriveAt: "", pnr: "", cabin: "", baggage: "", tickets: [] });

function validLocalDateTime(v: string): boolean {
  if (!LOCAL_DT.test(v)) return false;
  const d = new Date(`${v}:00Z`);
  return !Number.isNaN(d.getTime()) && d.toISOString().slice(0, 16) === v;
}

/** 13-digit tickets print as 176-1234567890 (airline code, serial). Other lengths between 10 and 14 digits are kept as typed digits. */
export function normaliseTicketNumber(v: unknown): string | null {
  const digits = String(v ?? "").replace(/[\s-]/g, "");
  if (!/^\d{10,14}$/.test(digits)) return null;
  return digits.length === 13 ? `${digits.slice(0, 3)}-${digits.slice(3)}` : digits;
}

/**
 * Cleans what the agent typed. Returns `flight: null` when every field is empty (so a line can have its details removed),
 * or an error naming the first thing that is wrong. IATA codes, flight numbers and booking references are upper-cased.
 */
export function sanitizeFlight(raw: unknown): { ok: true; flight: Flight | null } | { ok: false; error: string } {
  if (raw === null || raw === undefined) return { ok: true, flight: null };
  if (typeof raw !== "object") return { ok: false, error: "Flight details are not valid." };
  const r = raw as Record<string, unknown>;
  const f: Flight = {
    airline: clean(r.airline, 60),
    flightNumber: clean(r.flightNumber, 20).toUpperCase().replace(/\s+/g, ""),
    origin: clean(r.origin, 20).toUpperCase(), destination: clean(r.destination, 20).toUpperCase(),
    departAt: clean(r.departAt, 16), arriveAt: clean(r.arriveAt, 16),
    pnr: clean(r.pnr, 20).toUpperCase(), cabin: clean(r.cabin, 30), baggage: clean(r.baggage, 80), tickets: [],
  };
  if (f.flightNumber && !/^(?=[A-Z0-9]?[A-Z])[A-Z0-9]{2}\d{1,4}[A-Z]?$/.test(f.flightNumber)) return { ok: false, error: "Flight number should look like EK783 or W3101." };
  for (const [label, code] of [["From", f.origin], ["To", f.destination]] as const) if (code && !/^[A-Z]{3}$/.test(code)) return { ok: false, error: `${label} must be a 3-letter airport code, like LOS or DXB.` };
  if (f.departAt && !validLocalDateTime(f.departAt)) return { ok: false, error: "Enter a valid departure date and time." };
  if (f.arriveAt && !validLocalDateTime(f.arriveAt)) return { ok: false, error: "Enter a valid arrival date and time." };
  if (f.pnr && !/^[A-Z0-9]{5,8}$/.test(f.pnr)) return { ok: false, error: "The booking reference (PNR) is 5 to 8 letters or digits." };
  const tickets = Array.isArray(r.tickets) ? r.tickets.slice(0, 60) : [];
  const seen = new Set<string>();
  for (const t of tickets) {
    const o = (t ?? {}) as Record<string, unknown>;
    const name = clean(o.name, 120);
    const raw = String(o.number ?? "").trim();
    if (!raw) continue;
    const number = normaliseTicketNumber(raw);
    if (!number) return { ok: false, error: `Ticket number "${raw.slice(0, 20)}" should be 10 to 14 digits.` };
    if (seen.has(number)) return { ok: false, error: `Ticket number ${number} is listed twice.` };
    seen.add(number);
    f.tickets.push({ name, number });
  }
  const empty = !Object.entries(f).some(([k, v]) => (k === "tickets" ? (v as FlightTicket[]).length > 0 : !!v));
  return { ok: true, flight: empty ? null : f };
}

/** Reads a stored JSON value back into a Flight, tolerating older or hand-edited rows. */
export function readFlight(stored: unknown): Flight | null {
  const r = sanitizeFlight(stored);
  return r.ok ? r.flight : null;
}

const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
/** "1 Jun 2027 08:30" from a local date-time string. */
export function formatLocalDateTime(v: string): string {
  if (!validLocalDateTime(v)) return "";
  const [d, t] = v.split("T");
  const [y, m, day] = d.split("-").map(Number);
  return `${day} ${MONTHS[m - 1]} ${y} ${t}`;
}

/** One line for the route and times: "EK783 · LOS → DXB · 1 Jun 2027 08:30 → 1 Jun 2027 19:45". */
export function flightSummary(f: Flight): string {
  const route = f.origin && f.destination ? `${f.origin} → ${f.destination}` : f.origin || f.destination;
  const times = [f.departAt && formatLocalDateTime(f.departAt), f.arriveAt && formatLocalDateTime(f.arriveAt)].filter(Boolean).join(" → ");
  return [[f.airline, f.flightNumber].filter(Boolean).join(" "), route, times].filter(Boolean).join(" · ");
}

/**
 * What the traveller may see. The booking reference and ticket numbers can be used to look up or change a booking,
 * so `includePrivate` is only true for documents the agency hands over itself and for a client who has accepted.
 */
export function flightClientLines(f: Flight, includePrivate: boolean): string[] {
  const lines: string[] = [];
  const s = flightSummary(f);
  if (s) lines.push(s);
  const extra = [f.cabin && `Class: ${f.cabin}`, f.baggage && `Baggage: ${f.baggage}`, includePrivate && f.pnr && `Booking ref: ${f.pnr}`].filter(Boolean).join("  ·  ");
  if (extra) lines.push(extra);
  if (includePrivate) for (const t of f.tickets) lines.push(`Ticket${t.name ? ` ${t.name}` : ""}: ${t.number}`);
  return lines;
}

/** Details safe to show on a link that anyone holding it can open before the client has accepted. */
export function publicFlight(f: Flight | null, accepted: boolean): Flight | null {
  if (!f) return null;
  return accepted ? f : { ...f, pnr: "", tickets: [] };
}

// ---------------------------------------------------------------- ticketing deadline

/** True once every traveller has a ticket number. */
export function ticketsIssued(f: Flight | null, travellerCount: number): boolean {
  return !!f && travellerCount > 0 && f.tickets.length >= travellerCount;
}

export type TicketingState = "overdue" | "soon" | "later";

/** "soon" is within 2 days. Null when there is no deadline or the tickets are already issued. */
export function ticketingState(deadline: Date | null, issued: boolean, now = new Date()): TicketingState | null {
  if (!deadline || issued) return null;
  const ms = deadline.getTime() - now.getTime();
  if (ms < 0) return "overdue";
  return ms <= 2 * 86_400_000 ? "soon" : "later";
}

/** Should the cron job alert the agency now? Once per line, from 2 days before until a week after the deadline. */
export function ticketingAlertDue(deadline: Date | null, issued: boolean, alreadyAlerted: boolean, now = new Date()): boolean {
  if (alreadyAlerted || !deadline) return false;
  const state = ticketingState(deadline, issued, now);
  if (state !== "soon" && state !== "overdue") return false;
  return now.getTime() - deadline.getTime() <= 7 * 86_400_000;
}
