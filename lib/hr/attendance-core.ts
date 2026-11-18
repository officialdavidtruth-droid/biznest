/**
 * Pure attendance maths (no database): time zones, work-day boundaries, late detection and the
 * parsers for what fingerprint/face scanners send. Kept free of I/O so it can be unit tested.
 */

export const DEFAULT_TZ = "Africa/Lagos";
/** A second tap this soon after the first is treated as a double-scan, not a clock-out. */
export const MIN_SHIFT_MINUTES = 2;

type Parts = { y: number; m: number; d: number; hh: number; mm: number; ss: number };

/** Wall-clock parts of an instant in an IANA time zone. */
export function zonedParts(at: Date, timeZone: string): Parts {
  const f = new Intl.DateTimeFormat("en-GB", {
    timeZone, hourCycle: "h23", year: "numeric", month: "2-digit", day: "2-digit",
    hour: "2-digit", minute: "2-digit", second: "2-digit",
  });
  const o: Record<string, number> = {};
  for (const p of f.formatToParts(at)) if (p.type !== "literal") o[p.type] = Number(p.value);
  return { y: o.year, m: o.month, d: o.day, hh: o.hour, mm: o.minute, ss: o.second };
}

/** Minutes the zone is ahead of UTC at that instant (Lagos = 60). */
export function zoneOffsetMinutes(at: Date, timeZone: string): number {
  const p = zonedParts(at, timeZone);
  const asUtc = Date.UTC(p.y, p.m - 1, p.d, p.hh, p.mm, p.ss);
  return Math.round((asUtc - Math.floor(at.getTime() / 1000) * 1000) / 60000);
}

/** The calendar day an instant falls on in the store's time zone, as a UTC-midnight Date (matches @db.Date). */
export function workDateFor(at: Date, timeZone: string): Date {
  const p = zonedParts(at, timeZone);
  return new Date(Date.UTC(p.y, p.m - 1, p.d));
}

/** The UTC instants bounding a work date in the store's zone: [start, end). */
export function dayBounds(workDate: Date, timeZone: string): { start: Date; end: Date } {
  const at = (day: Date) => {
    let guess = day.getTime();
    for (let i = 0; i < 2; i++) guess = day.getTime() - zoneOffsetMinutes(new Date(guess), timeZone) * 60000;
    return new Date(guess);
  };
  const next = new Date(workDate.getTime() + 86_400_000);
  return { start: at(workDate), end: at(next) };
}

/**
 * Scanners send local wall-clock time with no zone ("2026-11-18 08:02:11"). Convert using the
 * device's own offset. Returns null for anything that isn't a real timestamp.
 */
export function parseDeviceTime(raw: string, tzOffsetMinutes: number): Date | null {
  const s = raw.trim();
  const m = s.match(/^(\d{4})-(\d{2})-(\d{2})[ T](\d{2}):(\d{2})(?::(\d{2}))?$/);
  if (m) {
    const [, y, mo, d, hh, mi, ss] = m;
    const t = Date.UTC(+y, +mo - 1, +d, +hh, +mi, +(ss ?? 0)) - tzOffsetMinutes * 60000;
    const dt = new Date(t);
    // Reject overflowed dates like 2026-02-31.
    const back = new Date(t + tzOffsetMinutes * 60000);
    if (back.getUTCMonth() !== +mo - 1 || back.getUTCDate() !== +d) return null;
    return dt;
  }
  // ISO strings that carry their own zone (Z or +01:00) are taken as-is.
  if (/(?:Z|[+-]\d{2}:?\d{2})$/.test(s)) {
    const dt = new Date(s);
    return Number.isNaN(dt.getTime()) ? null : dt;
  }
  return null;
}

/** "09:00" -> minutes after midnight, or null. */
export function parseClock(hhmm: string): number | null {
  const m = hhmm.match(/^(\d{1,2}):(\d{2})$/);
  if (!m) return null;
  const h = +m[1], mi = +m[2];
  return h > 23 || mi > 59 ? null : h * 60 + mi;
}

/** PRESENT if they arrived by shift start + grace, otherwise LATE. */
export function classifyArrival(checkIn: Date, timeZone: string, shiftStart: string, graceMinutes: number): "PRESENT" | "LATE" {
  const start = parseClock(shiftStart) ?? 9 * 60;
  const p = zonedParts(checkIn, timeZone);
  const minutes = p.hh * 60 + p.mm;
  return minutes <= start + Math.max(0, graceMinutes) ? "PRESENT" : "LATE";
}

/** First scan of the day is the check-in; the last one (if far enough after) is the check-out. */
export function foldDay<T extends { at: Date }>(punches: T[]): { first: T; last: T | null } | null {
  if (!punches.length) return null;
  const sorted = [...punches].sort((a, b) => a.at.getTime() - b.at.getTime());
  const first = sorted[0];
  const last = sorted[sorted.length - 1];
  const far = last.at.getTime() - first.at.getTime() >= MIN_SHIFT_MINUTES * 60000;
  return { first, last: far ? last : null };
}

export type RawScan = { userId: string; time: string; state: string | null; verify: string | null };

/**
 * Parses the body a ZKTeco-style scanner POSTs to /iclock/cdata?table=ATTLOG. One line per scan,
 * tab separated: PIN, "YYYY-MM-DD HH:MM:SS", status, verify mode, work code, ...
 */
export function parseAttLog(body: string): RawScan[] {
  const out: RawScan[] = [];
  for (const line of body.split(/\r?\n/)) {
    if (!line.trim()) continue;
    const c = line.split("\t");
    if (c.length < 2) continue;
    const userId = c[0].trim();
    const time = c[1].trim();
    if (!userId || !/^\d{4}-\d{2}-\d{2}[ T]\d{2}:\d{2}/.test(time)) continue;
    out.push({ userId, time, state: c[2]?.trim() || null, verify: c[3]?.trim() || null });
  }
  return out;
}

/** Minutes between check-in and check-out, or null if either is missing. */
export function workedMinutes(checkIn: Date | null, checkOut: Date | null): number | null {
  if (!checkIn || !checkOut || checkOut <= checkIn) return null;
  return Math.round((checkOut.getTime() - checkIn.getTime()) / 60000);
}

/** Parses CSV exported from a scanner: userId,datetime per line (header and extra columns tolerated). */
export function parsePunchCsv(text: string): { rows: RawScan[]; skipped: number } {
  const rows: RawScan[] = [];
  let skipped = 0;
  for (const raw of text.split(/\r?\n/)) {
    const line = raw.trim();
    if (!line) continue;
    const cells = line.split(/[,;\t]/).map((x) => x.replace(/^"|"$/g, "").trim());
    // Accept "id, date time" or "id, date, time".
    let time = cells[1] ?? "";
    if (cells[2] && /^\d{1,2}:\d{2}(:\d{2})?$/.test(cells[2]) && /^\d{4}-\d{2}-\d{2}$/.test(time)) time = `${time} ${cells[2]}`;
    if (!cells[0] || !/^\d{4}-\d{2}-\d{2}[ T]\d{2}:\d{2}/.test(time)) { skipped++; continue; }
    rows.push({ userId: cells[0], time, state: null, verify: null });
  }
  return { rows, skipped };
}
