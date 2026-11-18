import { describe, it, expect } from "vitest";
import {
  zonedParts, workDateFor, dayBounds, parseDeviceTime, classifyArrival, foldDay, parseAttLog, parsePunchCsv, workedMinutes, zoneOffsetMinutes,
} from "@/lib/hr/attendance-core";

const TZ = "Africa/Lagos";

describe("time zones", () => {
  it("Lagos is UTC+1", () => expect(zoneOffsetMinutes(new Date("2026-11-18T07:00:00Z"), TZ)).toBe(60));
  it("work date uses the local day, not the UTC day", () => {
    // 23:30 UTC on the 17th is 00:30 on the 18th in Lagos.
    expect(workDateFor(new Date("2026-11-17T23:30:00Z"), TZ).toISOString()).toBe("2026-11-18T00:00:00.000Z");
    expect(workDateFor(new Date("2026-11-18T07:00:00Z"), TZ).toISOString()).toBe("2026-11-18T00:00:00.000Z");
  });
  it("day bounds start at local midnight", () => {
    const { start, end } = dayBounds(new Date("2026-11-18T00:00:00Z"), TZ);
    expect(start.toISOString()).toBe("2026-11-17T23:00:00.000Z");
    expect(end.toISOString()).toBe("2026-11-18T23:00:00.000Z");
  });
  it("wall-clock parts", () => expect(zonedParts(new Date("2026-11-18T07:05:09Z"), TZ)).toMatchObject({ hh: 8, mm: 5, ss: 9 }));
});

describe("device time", () => {
  it("converts local scanner time to UTC", () => expect(parseDeviceTime("2026-11-18 08:02:11", 60)?.toISOString()).toBe("2026-11-18T07:02:11.000Z"));
  it("rejects garbage and impossible dates", () => {
    expect(parseDeviceTime("hello", 60)).toBeNull();
    expect(parseDeviceTime("2026-02-31 08:00:00", 60)).toBeNull();
  });
  it("keeps explicit zones", () => expect(parseDeviceTime("2026-11-18T08:00:00+01:00", 0)?.toISOString()).toBe("2026-11-18T07:00:00.000Z"));
});

describe("late detection", () => {
  const at = (iso: string) => new Date(iso);
  it("on time inside the grace window", () => expect(classifyArrival(at("2026-11-18T08:10:00Z"), TZ, "09:00", 15)).toBe("PRESENT")); // 09:10 Lagos
  it("late after grace", () => expect(classifyArrival(at("2026-11-18T08:16:00Z"), TZ, "09:00", 15)).toBe("LATE"));
});

describe("fold a day of scans", () => {
  const p = (iso: string) => ({ at: new Date(iso) });
  it("single scan is check-in only", () => expect(foldDay([p("2026-11-18T07:00:00Z")])?.last).toBeNull());
  it("double tap does not clock out", () => expect(foldDay([p("2026-11-18T07:00:00Z"), p("2026-11-18T07:01:00Z")])?.last).toBeNull());
  it("first and last", () => {
    const r = foldDay([p("2026-11-18T15:00:00Z"), p("2026-11-18T07:00:00Z"), p("2026-11-18T11:00:00Z")])!;
    expect(r.first.at.toISOString()).toBe("2026-11-18T07:00:00.000Z");
    expect(r.last?.at.toISOString()).toBe("2026-11-18T15:00:00.000Z");
  });
  it("worked minutes", () => expect(workedMinutes(new Date("2026-11-18T07:00:00Z"), new Date("2026-11-18T15:30:00Z"))).toBe(510));
});

describe("scanner payloads", () => {
  it("parses ATTLOG lines", () => {
    const rows = parseAttLog("12\t2026-11-18 08:02:11\t0\t1\t0\t0\t0\n7\t2026-11-18 17:30:00\t1\t15\n\nbad line\n");
    expect(rows).toEqual([
      { userId: "12", time: "2026-11-18 08:02:11", state: "0", verify: "1" },
      { userId: "7", time: "2026-11-18 17:30:00", state: "1", verify: "15" },
    ]);
  });
  it("parses CSV with header and split date/time", () => {
    const { rows, skipped } = parsePunchCsv('UserID,DateTime\n12,2026-11-18 08:02:11\n7,2026-11-18,17:30:00\nx,nope\n');
    expect(rows.map((r) => [r.userId, r.time])).toEqual([["12", "2026-11-18 08:02:11"], ["7", "2026-11-18 17:30:00"]]);
    expect(skipped).toBe(2);
  });
});
