import { describe, expect, it } from "vitest";
import { addDaysISO, isoDate, parseBookingQuery } from "@/lib/hotel-booking-query";

describe("isoDate / addDaysISO", () => {
  it("uses local calendar date and rolls over month and year ends", () => {
    expect(isoDate(new Date(2026, 9, 23, 0, 30))).toBe("2026-10-23");
    expect(addDaysISO("2026-10-31", 1)).toBe("2026-11-01");
    expect(addDaysISO("2026-12-31", 1)).toBe("2027-01-01");
    expect(addDaysISO("2028-02-28", 1)).toBe("2028-02-29");
  });
});

describe("parseBookingQuery", () => {
  const today = "2026-10-23";

  it("reads valid dates and guests", () => {
    expect(parseBookingQuery("?checkIn=2026-11-02&checkOut=2026-11-05&guests=3", today)).toEqual({
      checkIn: "2026-11-02",
      checkOut: "2026-11-05",
      guests: 3,
    });
  });

  it("moves a past check-in to today and keeps the stay valid", () => {
    expect(parseBookingQuery("?checkIn=2026-10-01&checkOut=2026-10-03", today)).toEqual({ checkIn: today, checkOut: "2026-10-24" });
  });

  it("fixes a check-out that is not after check-in", () => {
    expect(parseBookingQuery("?checkIn=2026-11-02&checkOut=2026-11-02", today)).toEqual({ checkIn: "2026-11-02", checkOut: "2026-11-03" });
    expect(parseBookingQuery("?checkIn=2026-11-02&checkOut=2026-10-30", today)).toEqual({ checkIn: "2026-11-02", checkOut: "2026-11-03" });
  });

  it("defaults check-out to the next day when absent", () => {
    expect(parseBookingQuery("?checkIn=2026-11-02", today)).toEqual({ checkIn: "2026-11-02", checkOut: "2026-11-03" });
  });

  it("ignores garbage and impossible dates", () => {
    expect(parseBookingQuery("?checkIn=tomorrow&guests=banana", today)).toEqual({});
    expect(parseBookingQuery("?checkIn=2026-02-31&checkOut=2026-03-02", today)).toEqual({});
    expect(parseBookingQuery("", today)).toEqual({});
  });

  it("only accepts 1-4 guests (what the form offers)", () => {
    expect(parseBookingQuery("?guests=0", today)).toEqual({});
    expect(parseBookingQuery("?guests=9", today)).toEqual({});
    expect(parseBookingQuery("?guests=2.5", today)).toEqual({});
    expect(parseBookingQuery("?guests=4", today)).toEqual({ guests: 4 });
  });
});
