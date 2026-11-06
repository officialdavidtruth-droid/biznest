/**
 * Pure helpers for the live two-way channel link: signing, inbound event
 * validation, availability payloads and retry back-off. No database, no network.
 */
import crypto from "crypto";

export const SIGNATURE_TOLERANCE_MS = 5 * 60_000;
export const MAX_PUSH_ATTEMPTS = 6;
export const MAX_INBOUND_EVENTS = 200;
export const MAX_INBOUND_BYTES = 256_000;
/** How far ahead an availability snapshot looks. */
export const PUSH_HORIZON_DAYS = 540;
/** A channel calendar older than this is refreshed before a booking is accepted. */
export const FRESH_MAX_AGE_MS = 10 * 60_000;

const DAY_MS = 86_400_000;

export function newLiveCredentials() {
  return { hookToken: crypto.randomBytes(24).toString("hex"), liveSecret: crypto.randomBytes(32).toString("hex") };
}
export const HOOK_TOKEN_RE = /^[a-f0-9]{48}$/;

/** HMAC-SHA256 over `${timestamp}.${rawBody}`, as `sha256=<hex>`. */
export function signBody(secret: string, timestamp: string, rawBody: string): string {
  return "sha256=" + crypto.createHmac("sha256", secret).update(`${timestamp}.${rawBody}`).digest("hex");
}

export function verifySignature(opts: { secret: string; timestamp: string | null; signature: string | null; rawBody: string; nowMs?: number; toleranceMs?: number }): boolean {
  const { secret, timestamp, signature, rawBody } = opts;
  if (!secret || !timestamp || !signature) return false;
  const t = Number(timestamp);
  if (!Number.isFinite(t)) return false;
  // Accept seconds or milliseconds since the epoch.
  const tMs = t < 1e12 ? t * 1000 : t;
  const now = opts.nowMs ?? Date.now();
  if (Math.abs(now - tMs) > (opts.toleranceMs ?? SIGNATURE_TOLERANCE_MS)) return false;
  const expected = Buffer.from(signBody(secret, timestamp, rawBody));
  const given = Buffer.from(signature.trim());
  return expected.length === given.length && crypto.timingSafeEqual(expected, given);
}

/** Wait before retry number `attempts` (1 = first retry). */
export function retryDelayMs(attempts: number): number {
  const steps = [60_000, 5 * 60_000, 30 * 60_000, 2 * 3_600_000, 6 * 3_600_000];
  return steps[Math.min(Math.max(attempts, 1), steps.length) - 1];
}

// ---------------------------------------------------------------- inbound

export type InboundEvent =
  | { type: "booking.created" | "booking.updated"; uid: string; start: Date; end: Date; summary: string | null }
  | { type: "booking.cancelled"; uid: string };

const DATE_RE = /^(\d{4})-(\d{2})-(\d{2})$/;
export function parseDay(v: unknown): Date | null {
  if (typeof v !== "string") return null;
  const m = DATE_RE.exec(v.trim());
  if (!m) return null;
  const d = new Date(Date.UTC(Number(m[1]), Number(m[2]) - 1, Number(m[3])));
  // Reject 2026-02-31 style rollovers.
  return d.getUTCFullYear() === Number(m[1]) && d.getUTCMonth() === Number(m[2]) - 1 && d.getUTCDate() === Number(m[3]) ? d : null;
}
export const dayKey = (d: Date) => d.toISOString().slice(0, 10);

/** Validate a decoded webhook body: `{ events: [...] }` or a single event object. */
export function parseInboundEvents(body: unknown): { ok: true; events: InboundEvent[] } | { ok: false; error: string } {
  if (!body || typeof body !== "object") return { ok: false, error: "Send a JSON object." };
  const raw = Array.isArray((body as { events?: unknown }).events) ? ((body as { events: unknown[] }).events) : [body];
  if (raw.length === 0) return { ok: false, error: "No events." };
  if (raw.length > MAX_INBOUND_EVENTS) return { ok: false, error: `At most ${MAX_INBOUND_EVENTS} events per request.` };
  const events: InboundEvent[] = [];
  for (const [i, e] of raw.entries()) {
    if (!e || typeof e !== "object") return { ok: false, error: `Event ${i + 1} is not an object.` };
    const ev = e as Record<string, unknown>;
    const type = ev.type;
    const uid = typeof ev.uid === "string" ? ev.uid.trim() : "";
    if (!uid || uid.length > 200) return { ok: false, error: `Event ${i + 1}: uid is required (max 200 characters).` };
    if (type === "booking.cancelled") { events.push({ type, uid }); continue; }
    if (type !== "booking.created" && type !== "booking.updated") return { ok: false, error: `Event ${i + 1}: unknown type.` };
    const start = parseDay(ev.start);
    const end = parseDay(ev.end);
    if (!start || !end) return { ok: false, error: `Event ${i + 1}: start and end must be YYYY-MM-DD dates.` };
    if (end.getTime() <= start.getTime()) return { ok: false, error: `Event ${i + 1}: end must be after start.` };
    if (end.getTime() - start.getTime() > 366 * DAY_MS) return { ok: false, error: `Event ${i + 1}: a stay can't be longer than a year.` };
    const summary = typeof ev.summary === "string" ? ev.summary.trim().slice(0, 200) || null : null;
    events.push({ type, uid, start, end, summary });
  }
  return { ok: true, events };
}

// ---------------------------------------------------------------- outbound

export type BusyRange = { start: string; end: string; source: "direct" | "online" | "other_channel" };

type Raw = { start: Date; end: Date; source: BusyRange["source"] };

/** Day-granular, sorted, deduped ranges. Touching ranges are kept apart so sources stay visible. */
export function toBusyRanges(raw: Raw[], opts: { from?: Date; horizonDays?: number } = {}): BusyRange[] {
  const from = opts.from ?? new Date(Date.now() - 2 * DAY_MS);
  const to = new Date(from.getTime() + (opts.horizonDays ?? PUSH_HORIZON_DAYS) * DAY_MS);
  const seen = new Set<string>();
  const out: BusyRange[] = [];
  for (const r of raw) {
    const start = dayKey(r.start);
    let end = dayKey(r.end);
    if (end <= start) end = dayKey(new Date(Date.parse(start + "T00:00:00Z") + DAY_MS));
    if (end <= dayKey(from) || start >= dayKey(to)) continue;
    const k = `${start}|${end}|${r.source}`;
    if (seen.has(k)) continue;
    seen.add(k);
    out.push({ start, end, source: r.source });
  }
  return out.sort((a, b) => (a.start < b.start ? -1 : a.start > b.start ? 1 : a.end < b.end ? -1 : a.end > b.end ? 1 : 0));
}

export type PushPayload = {
  event: "availability.updated" | "test";
  seq: number;
  sentAt: string;
  property: string;
  room: { id: string; name: string };
  channel: { id: string; provider: string };
  /** Dates NOT sellable on this channel. end is exclusive (check-out day is free again). */
  busy: BusyRange[];
};

export function buildPushPayload(input: { event?: PushPayload["event"]; seq: number; now?: Date; property: string; room: { id: string; name: string }; channel: { id: string; provider: string }; busy: BusyRange[] }): PushPayload {
  return { event: input.event ?? "availability.updated", seq: input.seq, sentAt: (input.now ?? new Date()).toISOString(), property: input.property, room: input.room, channel: input.channel, busy: input.busy };
}

/** Overlap test with iCal semantics (end exclusive). */
export function overlaps(a: { start: Date; end: Date }, b: { start: Date; end: Date }) {
  return a.start < b.end && a.end > b.start;
}

export function safePushUrl(raw: string | undefined | null): string | null {
  const v = (raw ?? "").trim();
  if (!v) return null;
  try {
    const u = new URL(v);
    if (u.protocol !== "https:" || u.username || u.password) return null;
    return u.toString();
  } catch { return null; }
}
