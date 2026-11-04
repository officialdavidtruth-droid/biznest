import { describe, expect, it } from "vitest";
import { parseDepartureDates, readTripConfig, tripTotal } from "@/lib/trip-booking";
import { serviceSchema } from "@/lib/validations/service";

describe("trip booking helpers", () => {
  it("reads a trip config only for bookable, non-unit services marked as trips", () => {
    const attrs = { bookingKind: "trip", tripSeats: 12, tripPricing: "group", tripDepartures: "2027-02-01, 2027-01-10, bad, 2027-01-10" };
    expect(readTripConfig(attrs)).toEqual({ seats: 12, pricing: "group", departures: ["2027-01-10", "2027-02-01"] });
    expect(readTripConfig(attrs, false)).toBeNull();
    expect(readTripConfig(attrs, true, 5)).toBeNull();
    expect(readTripConfig({ ...attrs, bookingKind: undefined })).toBeNull();
    expect(readTripConfig({ bookingKind: "trip", tripSeats: 0 })).toBeNull();
    expect(readTripConfig(null)).toBeNull();
  });

  it("defaults to per-person pricing and any date", () => {
    expect(readTripConfig({ bookingKind: "trip", tripSeats: 8 })).toEqual({ seats: 8, pricing: "person", departures: [] });
  });

  it("prices per person or flat", () => {
    expect(tripTotal(250000, "person", 3)).toBe(750000);
    expect(tripTotal(250000, "group", 3)).toBe(250000);
    expect(tripTotal(250000, "person", 0)).toBe(250000);
  });

  it("parses departure lists", () => {
    expect(parseDepartureDates("2027-03-01;2027-02-01 2027-03-01")).toEqual(["2027-02-01", "2027-03-01"]);
    expect(parseDepartureDates(undefined)).toEqual([]);
  });

  it("accepts the trip booking mode", () => {
    const r = serviceSchema.safeParse({ name: "Dubai 5 days", description: "Flights, hotel and tours.", price: 900000, images: [], bookingMode: "trip", attributes: { bookingKind: "trip", tripSeats: 10 } });
    expect(r.success).toBe(true);
  });
});
