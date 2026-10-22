/**
 * Minimal, dependency-free iCalendar (RFC 5545) support for OTA calendar sync.
 *
 * Every major OTA (Booking.com, Airbnb, Expedia, Vrbo, Agoda, ...) can import
 * and export an .ics calendar of unavailable dates per listing. We only need
 * VEVENT date ranges, so this deliberately implements just that.
 *
 * Date semantics: all-day DTEND is EXCLUSIVE (a stay 5th->7th has DTEND the
 * 7th), which matches hotel check-out day being free again.
 */

export type IcsEvent = { uid: string; start: Date; end: Date; summary: string | null };

const MAX_EVENTS = 2000;
const DAY_MS = 86_400_000;

/** Undo RFC 5545 line folding (CRLF + space/tab) and normalise newlines. */
function unfold(text: string): string[] {
  return text.replace(/\r\n/g, "\n").replace(/\r/g, "\n").replace(/\n[ \t]/g, "").split("\n");
}

function unescapeText(v: string): string {
  return v.replace(/\\n/gi, " ").replace(/\\,/g, ",").replace(/\\;/g, ";").replace(/\\\\/g, "\\").trim();
}

/** "20261105" or "20261105T140000Z" / "20261105T140000" -> {date, hasTime} (UTC). */
function parseIcsDate(value: string): { date: Date; hasTime: boolean } | null {
  const m = /^(\d{4})(\d{2})(\d{2})(?:T(\d{2})(\d{2})(\d{2})Z?)?$/.exec(value.trim());
  if (!m) return null;
  const [, y, mo, d, hh, mm, ss] = m;
  const date = new Date(Date.UTC(Number(y), Number(mo) - 1, Number(d), Number(hh ?? 0), Number(mm ?? 0), Number(ss ?? 0)));
  if (!Number.isFinite(date.getTime())) return null;
  return { date, hasTime: hh !== undefined };
}

function startOfUtcDay(d: Date): Date {
  return new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()));
}

/**
 * Parse the VEVENTs of an .ics document into day-granular blocked ranges.
 * Cancelled events and ranges that ended before `now` (minus a day) are dropped.
 */
export function parseIcs(text: string, now: Date = new Date()): IcsEvent[] {
  const lines = unfold(text);
  const events: IcsEvent[] = [];
  const cutoff = startOfUtcDay(new Date(now.getTime() - DAY_MS));

  let inEvent = false;
  let cur: Record<string, string> = {};

  for (const raw of lines) {
    const line = raw.trimEnd();
    if (line === "BEGIN:VEVENT") { inEvent = true; cur = {}; continue; }
    if (line === "END:VEVENT") {
      inEvent = false;
      const startParsed = cur["DTSTART"] ? parseIcsDate(cur["DTSTART"]) : null;
      if (startParsed && cur["STATUS"]?.toUpperCase() !== "CANCELLED") {
        const start = startOfUtcDay(startParsed.date);
        const endParsed = cur["DTEND"] ? parseIcsDate(cur["DTEND"]) : null;
        let end = endParsed ? startOfUtcDay(endParsed.date) : new Date(start.getTime() + DAY_MS);
        if (end.getTime() <= start.getTime()) end = new Date(start.getTime() + DAY_MS);
        if (end.getTime() > cutoff.getTime()) {
          const uid = cur["UID"] || `${start.toISOString()}_${end.toISOString()}`;
          events.push({ uid: uid.slice(0, 250), start, end, summary: cur["SUMMARY"] ? unescapeText(cur["SUMMARY"]).slice(0, 200) : null });
          if (events.length >= MAX_EVENTS) break;
        }
      }
      continue;
    }
    if (!inEvent) continue;

    const idx = line.indexOf(":");
    if (idx < 1) continue;
    const name = line.slice(0, idx).split(";")[0].toUpperCase();
    if (name === "DTSTART" || name === "DTEND" || name === "UID" || name === "SUMMARY" || name === "STATUS") {
      cur[name] = line.slice(idx + 1);
    }
  }
  return events;
}

/** True when the document is plausibly an iCalendar feed (cheap sanity check). */
export function looksLikeIcs(text: string): boolean {
  return /BEGIN:VCALENDAR/i.test(text);
}

function escapeText(v: string): string {
  return v.replace(/\\/g, "\\\\").replace(/;/g, "\\;").replace(/,/g, "\\,").replace(/\r?\n/g, "\\n");
}

/** YYYY-MM-DD of an instant as seen in the hotel's own timezone. */
export function dateKey(d: Date, timeZone = "Africa/Lagos"): string {
  try {
    return new Intl.DateTimeFormat("en-CA", { timeZone, year: "numeric", month: "2-digit", day: "2-digit" }).format(d);
  } catch {
    return d.toISOString().slice(0, 10);
  }
}

function icsDay(key: string): string {
  return key.replace(/-/g, "");
}

export type ExportRange = { uid: string; checkIn: Date; checkOut: Date; summary: string };

/** Build an .ics feed. Guest names/contact details are never included. */
export function buildIcs(opts: { calendarName: string; ranges: ExportRange[]; timeZone?: string; now?: Date }): string {
  const tz = opts.timeZone ?? "Africa/Lagos";
  const stamp = (opts.now ?? new Date()).toISOString().replace(/[-:]/g, "").replace(/\.\d{3}/, "");
  const out: string[] = [
    "BEGIN:VCALENDAR",
    "VERSION:2.0",
    "PRODID:-//BizNest//Channel Sync//EN",
    "CALSCALE:GREGORIAN",
    "METHOD:PUBLISH",
    `X-WR-CALNAME:${escapeText(opts.calendarName)}`,
  ];
  for (const r of opts.ranges) {
    const startKey = dateKey(r.checkIn, tz);
    let endKey = dateKey(r.checkOut, tz);
    if (endKey <= startKey) {
      // Same-day / day-use stay: block that single day.
      const next = new Date(`${startKey}T00:00:00Z`);
      endKey = new Date(next.getTime() + DAY_MS).toISOString().slice(0, 10);
    }
    out.push(
      "BEGIN:VEVENT",
      `UID:${r.uid}`,
      `DTSTAMP:${stamp}`,
      `DTSTART;VALUE=DATE:${icsDay(startKey)}`,
      `DTEND;VALUE=DATE:${icsDay(endKey)}`,
      `SUMMARY:${escapeText(r.summary)}`,
      "TRANSP:OPAQUE",
      "END:VEVENT",
    );
  }
  out.push("END:VCALENDAR");
  return out.join("\r\n") + "\r\n";
}
