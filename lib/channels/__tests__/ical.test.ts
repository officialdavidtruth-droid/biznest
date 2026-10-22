import { describe, expect, it } from "vitest";
import { buildIcs, dateKey, looksLikeIcs, parseIcs } from "../ical";

const NOW = new Date("2026-11-01T10:00:00Z");

const feed = (events: string) => `BEGIN:VCALENDAR\r\nVERSION:2.0\r\n${events}END:VCALENDAR\r\n`;

describe("parseIcs", () => {
  it("reads all-day ranges with exclusive end", () => {
    const [e] = parseIcs(feed("BEGIN:VEVENT\r\nUID:a1\r\nDTSTART;VALUE=DATE:20261105\r\nDTEND;VALUE=DATE:20261108\r\nSUMMARY:Reserved\r\nEND:VEVENT\r\n"), NOW);
    expect(e.uid).toBe("a1");
    expect(e.start.toISOString()).toBe("2026-11-05T00:00:00.000Z");
    expect(e.end.toISOString()).toBe("2026-11-08T00:00:00.000Z");
  });

  it("handles datetimes, folded lines and missing DTEND", () => {
    const events = parseIcs(
      feed(
        "BEGIN:VEVENT\r\nUID:long-\r\n uid\r\nDTSTART:20261110T140000Z\r\nEND:VEVENT\r\n" +
        "BEGIN:VEVENT\r\nUID:b\r\nDTSTART:20261112T140000Z\r\nDTEND:20261114T110000Z\r\nEND:VEVENT\r\n",
      ),
      NOW,
    );
    expect(events[0].uid).toBe("long-uid");
    expect(events[0].end.toISOString()).toBe("2026-11-11T00:00:00.000Z"); // +1 day default
    expect(events[1].start.toISOString()).toBe("2026-11-12T00:00:00.000Z");
    expect(events[1].end.toISOString()).toBe("2026-11-14T00:00:00.000Z");
  });

  it("drops cancelled and long-past events, keeps garbage out", () => {
    const events = parseIcs(
      feed(
        "BEGIN:VEVENT\r\nUID:x\r\nSTATUS:CANCELLED\r\nDTSTART;VALUE=DATE:20261105\r\nEND:VEVENT\r\n" +
        "BEGIN:VEVENT\r\nUID:old\r\nDTSTART;VALUE=DATE:20250101\r\nDTEND;VALUE=DATE:20250103\r\nEND:VEVENT\r\n" +
        "BEGIN:VEVENT\r\nUID:bad\r\nDTSTART:notadate\r\nEND:VEVENT\r\n",
      ),
      NOW,
    );
    expect(events).toHaveLength(0);
  });

  it("looksLikeIcs rejects HTML", () => {
    expect(looksLikeIcs("<html>login</html>")).toBe(false);
    expect(looksLikeIcs("BEGIN:VCALENDAR\r\nEND:VCALENDAR")).toBe(true);
  });
});

describe("buildIcs", () => {
  it("emits all-day events in the hotel timezone with no guest data", () => {
    const out = buildIcs({
      calendarName: "Hotel, Room 1",
      now: NOW,
      ranges: [{ uid: "res-1@biznest.space", checkIn: new Date("2026-11-05T00:00:00Z"), checkOut: new Date("2026-11-07T00:00:00Z"), summary: "Reserved" }],
    });
    expect(out).toContain("DTSTART;VALUE=DATE:20261105");
    expect(out).toContain("DTEND;VALUE=DATE:20261107");
    expect(out).toContain("X-WR-CALNAME:Hotel\\, Room 1");
    expect(out.endsWith("\r\n")).toBe(true);
  });

  it("blocks one day for same-day stays and round-trips through parseIcs", () => {
    const out = buildIcs({ calendarName: "r", now: NOW, ranges: [{ uid: "u", checkIn: new Date("2026-11-05T09:00:00Z"), checkOut: new Date("2026-11-05T15:00:00Z"), summary: "Reserved" }] });
    const [e] = parseIcs(out, NOW);
    expect(e.start.toISOString()).toBe("2026-11-05T00:00:00.000Z");
    expect(e.end.toISOString()).toBe("2026-11-06T00:00:00.000Z");
  });

  it("dateKey uses the given timezone", () => {
    expect(dateKey(new Date("2026-11-05T23:30:00Z"), "Africa/Lagos")).toBe("2026-11-06");
  });
});
