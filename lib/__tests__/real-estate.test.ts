import { describe, expect, it } from "vitest";
import {
  addMonthsUtc, buildRentSchedule, chargeState, lastReceiptSeq, money, newPortalToken, periodLabel, receiptNumber, rentReminderKind, sanitizeTenant, summariseCharges,
} from "@/lib/real-estate";

const d = (s: string) => new Date(`${s}T00:00:00Z`);

describe("addMonthsUtc", () => {
  it("clamps to the last day instead of spilling into the next month", () => {
    expect(addMonthsUtc(d("2027-01-31"), 1).toISOString().slice(0, 10)).toBe("2027-02-28");
    expect(addMonthsUtc(d("2028-01-31"), 1).toISOString().slice(0, 10)).toBe("2028-02-29");
    expect(addMonthsUtc(d("2027-03-31"), 1).toISOString().slice(0, 10)).toBe("2027-04-30");
  });
  it("crosses years", () => {
    expect(addMonthsUtc(d("2027-11-15"), 3).toISOString().slice(0, 10)).toBe("2028-02-15");
  });
});

describe("buildRentSchedule", () => {
  it("makes one period by default and labels it", () => {
    const s = buildRentSchedule({ start: d("2027-01-01"), cycle: "ANNUAL" });
    expect(s).toHaveLength(1);
    expect(s[0].label).toBe("Jan 2027 to Dec 2027");
  });
  it("steps by the cycle", () => {
    const s = buildRentSchedule({ start: d("2027-01-31"), cycle: "MONTHLY", periods: 3 });
    expect(s.map((x) => x.dueDate.toISOString().slice(0, 10))).toEqual(["2027-01-31", "2027-02-28", "2027-03-31"]);
  });
  it("stops before the lease ends", () => {
    const s = buildRentSchedule({ start: d("2027-01-01"), cycle: "QUARTERLY", periods: 8, leaseEnd: d("2027-12-31") });
    expect(s).toHaveLength(4);
  });
  it("caps absurd period counts and floors at one", () => {
    expect(buildRentSchedule({ start: d("2027-01-01"), cycle: "MONTHLY", periods: 5000 })).toHaveLength(60);
    expect(buildRentSchedule({ start: d("2027-01-01"), cycle: "MONTHLY", periods: 0 })).toHaveLength(1);
    expect(buildRentSchedule({ start: d("2027-01-01"), cycle: "MONTHLY", periods: Number.NaN })).toHaveLength(1);
  });
  it("labels quarters across a year boundary", () => {
    expect(periodLabel(d("2027-11-01"), "QUARTERLY")).toBe("Nov 2027 to Jan 2028");
    expect(periodLabel(d("2027-01-01"), "QUARTERLY")).toBe("Jan to Mar 2027");
  });
});

describe("chargeState and summariseCharges", () => {
  const now = new Date("2027-03-10T10:00:00Z");
  it("classifies charges", () => {
    expect(chargeState({ status: "PAID", dueDate: d("2027-01-01"), amount: 1 }, now)).toBe("PAID");
    expect(chargeState({ status: "VOID", dueDate: d("2027-01-01"), amount: 1 }, now)).toBe("VOID");
    expect(chargeState({ status: "DUE", dueDate: d("2027-03-09"), amount: 1 }, now)).toBe("OVERDUE");
    expect(chargeState({ status: "DUE", dueDate: d("2027-03-10"), amount: 1 }, now)).toBe("DUE_SOON");
    expect(chargeState({ status: "DUE", dueDate: d("2027-03-30"), amount: 1 }, now)).toBe("UPCOMING");
  });
  it("totals, ignoring void charges", () => {
    const s = summariseCharges([
      { status: "PAID", dueDate: d("2027-01-01"), amount: "100000" },
      { status: "DUE", dueDate: d("2027-03-01"), amount: "50000.5" },
      { status: "DUE", dueDate: d("2027-06-01"), amount: "70000" },
      { status: "VOID", dueDate: d("2027-02-01"), amount: "999999" },
    ], now);
    expect(s).toMatchObject({ paid: 100000, outstanding: 120000.5, overdue: 50000.5, overdueCount: 1 });
    expect(s.nextDue?.toISOString().slice(0, 10)).toBe("2027-03-01");
  });
});

describe("receipts", () => {
  it("numbers sequentially and finds the highest existing number", () => {
    expect(receiptNumber(42)).toBe("RCT-000042");
    expect(receiptNumber(0)).toBe("RCT-000001");
    expect(lastReceiptSeq(["RCT-000007", null, "junk", "RCT-000012", "RCT-12x"])).toBe(12);
    expect(lastReceiptSeq([])).toBe(0);
  });
});

describe("reminders reuse the travel cadence", () => {
  const now = new Date("2027-03-10T10:00:00Z");
  it("reminds 3 days ahead once, on the day, and when overdue; never past the cap", () => {
    expect(rentReminderKind({ dueDate: d("2027-03-12"), reminderCount: 0, lastReminderAt: null }, now)).toBe("upcoming");
    expect(rentReminderKind({ dueDate: d("2027-03-10"), reminderCount: 1, lastReminderAt: null }, now)).toBe("due");
    expect(rentReminderKind({ dueDate: d("2027-03-01"), reminderCount: 1, lastReminderAt: null }, now)).toBe("overdue");
    expect(rentReminderKind({ dueDate: d("2027-03-01"), reminderCount: 4, lastReminderAt: null }, now)).toBeNull();
  });
});

describe("sanitizeTenant", () => {
  it("accepts a name alone and tidies contact details", () => {
    const r = sanitizeTenant({ name: "  Ada   Obi ", email: " ADA@Example.com ", phone: "+234 803 123 4567" });
    expect(r).toEqual({ ok: true, tenant: { name: "Ada Obi", email: "ada@example.com", phone: "+2348031234567" } });
    expect(sanitizeTenant({ name: "Tunde" })).toEqual({ ok: true, tenant: { name: "Tunde", email: null, phone: null } });
  });
  it("rejects a missing name, a bad email and a bad phone", () => {
    expect(sanitizeTenant({ name: " " })).toMatchObject({ ok: false });
    expect(sanitizeTenant({ name: "A", email: "nope" })).toMatchObject({ ok: false });
    expect(sanitizeTenant({ name: "A", phone: "123" })).toMatchObject({ ok: false });
  });
});

describe("money and tokens", () => {
  it("parses money and rejects junk", () => {
    expect(money("1,250,000.456")).toBe(1250000.46);
    expect(Number.isNaN(money("abc"))).toBe(true);
    expect(Number.isNaN(money(Infinity))).toBe(true);
  });
  it("makes unguessable url-safe portal tokens", () => {
    const a = newPortalToken(), b = newPortalToken();
    expect(a).toMatch(/^[A-Za-z0-9_-]{24}$/);
    expect(a).not.toBe(b);
  });
});
