import { describe, it, expect } from "vitest";
import {
  instalmentSchedule, allocateAgainstDue, reminderKind, convertCost, departureCapacity, bookingClosedByCutoff,
  departureDateError, agingBucket, profitOf, buildIcs, MAX_REMINDERS,
} from "../travel-growth";

const D = (s: string) => new Date(`${s}T00:00:00.000Z`);

describe("instalmentSchedule", () => {
  it("adds up exactly to the balance, remainder on the last instalment", () => {
    const s = instalmentSchedule({ balance: 1_000_000, count: 3, firstDue: D("2027-01-10"), intervalDays: 30 });
    expect(s.map((x) => x.amount)).toEqual([333_333, 333_333, 333_334]);
    expect(s.reduce((a, x) => a + x.amount, 0)).toBe(1_000_000);
    expect(s[1].dueDate.toISOString().slice(0, 10)).toBe("2027-02-09");
  });
  it("keeps kobo on the last instalment", () => {
    const s = instalmentSchedule({ balance: 100.5, count: 2, firstDue: D("2027-01-01"), intervalDays: 7 });
    expect(s.map((x) => x.amount)).toEqual([50, 50.5]);
  });
  it("rejects nonsense", () => {
    expect(instalmentSchedule({ balance: 0, count: 3, firstDue: D("2027-01-01"), intervalDays: 7 })).toEqual([]);
    expect(instalmentSchedule({ balance: 100, count: 0, firstDue: D("2027-01-01"), intervalDays: 7 })).toEqual([]);
    expect(instalmentSchedule({ balance: 100, count: 25, firstDue: D("2027-01-01"), intervalDays: 7 })).toEqual([]);
    expect(instalmentSchedule({ balance: 100, count: 2, firstDue: new Date("x"), intervalDays: 7 })).toEqual([]);
    expect(instalmentSchedule({ balance: 100, count: 2, firstDue: D("2027-01-01"), intervalDays: 0 })).toEqual([]);
  });
  it("drops zero-value instalments when the balance is tiny", () => {
    const s = instalmentSchedule({ balance: 2, count: 5, firstDue: D("2027-01-01"), intervalDays: 7 });
    expect(s.reduce((a, x) => a + x.amount, 0)).toBe(2);
    expect(s.every((x) => x.amount > 0)).toBe(true);
  });
});

describe("allocateAgainstDue", () => {
  const dues = [
    { id: "b", amount: 500, dueDate: D("2027-02-01") },
    { id: "a", amount: 300, dueDate: D("2027-01-01") },
    { id: "c", amount: 200, dueDate: null },
  ];
  it("pays oldest first and reduces the partly covered one", () => {
    expect(allocateAgainstDue(dues, 450)).toEqual([
      { id: "a", action: "settle", newAmount: 0 },
      { id: "b", action: "reduce", newAmount: 350 },
    ]);
  });
  it("settles everything on a full payment and ignores the surplus", () => {
    const r = allocateAgainstDue(dues, 5000);
    expect(r.map((x) => x.id)).toEqual(["a", "b", "c"]);
    expect(r.every((x) => x.action === "settle")).toBe(true);
  });
  it("does nothing for zero or negative amounts", () => {
    expect(allocateAgainstDue(dues, 0)).toEqual([]);
    expect(allocateAgainstDue(dues, -5)).toEqual([]);
  });
});

describe("reminderKind", () => {
  const now = new Date("2027-03-10T09:00:00Z");
  it("reminds 3 days before once, on the day, and when overdue", () => {
    expect(reminderKind({ dueDate: D("2027-03-13"), reminderCount: 0, lastReminderAt: null }, now)).toBe("upcoming");
    expect(reminderKind({ dueDate: D("2027-03-13"), reminderCount: 1, lastReminderAt: null }, now)).toBeNull();
    expect(reminderKind({ dueDate: D("2027-03-10"), reminderCount: 1, lastReminderAt: null }, now)).toBe("due");
    expect(reminderKind({ dueDate: D("2027-03-01"), reminderCount: 2, lastReminderAt: null }, now)).toBe("overdue");
  });
  it("is quiet far ahead, after the cap, and within 5 days of the last reminder", () => {
    expect(reminderKind({ dueDate: D("2027-04-10"), reminderCount: 0, lastReminderAt: null }, now)).toBeNull();
    expect(reminderKind({ dueDate: D("2027-03-01"), reminderCount: MAX_REMINDERS, lastReminderAt: null }, now)).toBeNull();
    expect(reminderKind({ dueDate: D("2027-03-01"), reminderCount: 1, lastReminderAt: new Date("2027-03-07T09:00:00Z") }, now)).toBeNull();
    expect(reminderKind({ dueDate: null, reminderCount: 0, lastReminderAt: null }, now)).toBeNull();
  });
});

describe("convertCost", () => {
  it("multiplies and rounds", () => {
    expect(convertCost(1200, 1550.5)).toBe(1_860_600);
    expect(convertCost("100", "1.005")).toBe(100.5);
  });
  it("rejects bad input", () => {
    expect(convertCost(-1, 1500)).toBeNull();
    expect(convertCost(100, 0)).toBeNull();
    expect(convertCost("abc", 1500)).toBeNull();
  });
});

describe("departures", () => {
  it("uses the departure's seats, else the package's", () => {
    expect(departureCapacity({ departureSeats: 20, packageSeats: 40 })).toBe(20);
    expect(departureCapacity({ departureSeats: 0, packageSeats: 40 })).toBe(40);
    expect(departureCapacity({ departureSeats: 0, packageSeats: 0 })).toBe(0);
  });
  it("closes online booking inside the cut-off window", () => {
    const dep = D("2027-06-20");
    expect(bookingClosedByCutoff(dep, 14, D("2027-06-05"))).toBe(false);
    expect(bookingClosedByCutoff(dep, 14, D("2027-06-07"))).toBe(true);
    expect(bookingClosedByCutoff(dep, 0, D("2027-06-19"))).toBe(false);
    expect(bookingClosedByCutoff(null, 14, D("2027-06-19"))).toBe(false);
  });
  it("validates new departure dates", () => {
    const now = D("2027-01-10");
    expect(departureDateError(null, [], now)).toMatch(/Choose/);
    expect(departureDateError(D("2026-12-01"), [], now)).toMatch(/past/);
    expect(departureDateError(D("2027-02-01"), [D("2027-02-01")], now)).toMatch(/already/);
    expect(departureDateError(D("2027-02-02"), [D("2027-02-01")], now)).toBeNull();
  });
});

describe("aging and profit", () => {
  const now = D("2027-05-01");
  it("buckets by days overdue", () => {
    expect(agingBucket(D("2027-05-10"), now)).toBe("CURRENT");
    expect(agingBucket(D("2027-04-20"), now)).toBe("1-30");
    expect(agingBucket(D("2027-03-20"), now)).toBe("31-60");
    expect(agingBucket(D("2027-02-20"), now)).toBe("61-90");
    expect(agingBucket(D("2026-12-01"), now)).toBe("90+");
    expect(agingBucket(null, now)).toBe("CURRENT");
  });
  it("profit is after cost and commission", () => {
    expect(profitOf({ price: 1000, cost: 700, commission: 50, paid: 0 })).toEqual({ profit: 250, marginPct: 25 });
    expect(profitOf({ price: 0, cost: 10, commission: 0, paid: 0 })).toEqual({ profit: -10, marginPct: null });
  });
});

describe("buildIcs", () => {
  const ics = buildIcs("Agency, departures", [
    { uid: "a@x", start: D("2027-06-20"), end: D("2027-06-26"), summary: "Dubai; 7 days", description: "Line1\nLine2, ok", location: "Dubai" },
    { uid: "bad", start: new Date("x"), summary: "skip" },
  ], new Date("2027-01-01T00:00:00Z"));
  it("is a valid-looking calendar with CRLF lines", () => {
    expect(ics.startsWith("BEGIN:VCALENDAR\r\n")).toBe(true);
    expect(ics.endsWith("END:VCALENDAR\r\n")).toBe(true);
    expect(ics).toContain("DTSTART;VALUE=DATE:20270620");
    expect(ics).toContain("DTEND;VALUE=DATE:20270627"); // inclusive last day → exclusive end
    expect(ics).toContain("SUMMARY:Dubai\\; 7 days");
    expect(ics).toContain("DESCRIPTION:Line1\\nLine2\\, ok");
    expect(ics).toContain("X-WR-CALNAME:Agency\\, departures");
    expect(ics).not.toContain("UID:bad");
  });
  it("folds long lines to 75 bytes", () => {
    const long = buildIcs("c", [{ uid: "l", start: D("2027-01-01"), summary: "é".repeat(100) }]);
    for (const line of long.split("\r\n")) expect(Buffer.byteLength(line)).toBeLessThanOrEqual(75);
  });
});
