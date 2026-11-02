import { describe, expect, it } from "vitest";
import { canMoveTrip, daysUntil, newTripReference, passportWarning, tripMoney } from "@/lib/travel";

describe("canMoveTrip", () => {
  it("blocks changes once a trip is completed or cancelled", () => {
    expect(canMoveTrip("COMPLETED", "CONFIRMED")).toBe(false);
    expect(canMoveTrip("CANCELLED", "ENQUIRY")).toBe(false);
  });
  it("allows normal progression and cancellation of open trips", () => {
    expect(canMoveTrip("ENQUIRY", "QUOTED")).toBe(true);
    expect(canMoveTrip("CONFIRMED", "CANCELLED")).toBe(true);
  });
  it("rejects a no-op move", () => expect(canMoveTrip("QUOTED", "QUOTED")).toBe(false));
});

describe("tripMoney", () => {
  it("counts only RECEIVED payments and never reports a negative balance", () => {
    const m = tripMoney({ totalPrice: "1000", totalCost: "700" }, [
      { amount: "400", status: "RECEIVED" }, { amount: "300", status: "DUE" }, { amount: "100", status: "VOID" },
    ]);
    expect(m).toEqual({ total: 1000, cost: 700, paid: 400, balance: 600, margin: 300, refunded: 0 });
    expect(tripMoney({ totalPrice: 100, totalCost: 0 }, [{ amount: 150, status: "RECEIVED" }]).balance).toBe(0);
  });
});

describe("passportWarning", () => {
  const travel = new Date("2027-03-01");
  it("flags passports expiring before or within 6 months of travel", () => {
    expect(passportWarning("2027-01-01", travel)).toMatch(/expired/i);
    expect(passportWarning("2027-06-01", travel)).toMatch(/6 months/);
  });
  it("is quiet for a healthy passport or missing data", () => {
    expect(passportWarning("2030-01-01", travel)).toBeNull();
    expect(passportWarning(null, travel)).toBeNull();
  });
});

describe("helpers", () => {
  it("builds unique-looking references", () => {
    const a = newTripReference(new Date("2026-11-01")), b = newTripReference(new Date("2026-11-01"));
    expect(a).toMatch(/^TRV-2611-[A-Z0-9]{4}$/);
    expect(a).not.toBe(b);
  });
  it("computes days until a date", () => {
    expect(daysUntil("2026-11-11", new Date("2026-11-01T00:00:00Z"))).toBe(10);
    expect(daysUntil(null)).toBeNull();
  });
});

import { depositFor, canPayOnline } from "@/lib/travel";
describe("depositFor / canPayOnline", () => {
  it("rounds a percentage deposit up and never exceeds the total", () => {
    expect(depositFor(200000, 30)).toBe(60000);
    expect(depositFor(100001, 30)).toBe(30001);
    expect(depositFor(500, 100)).toBe(500);
    expect(depositFor(1000, 150)).toBe(1000);
  });
  it("is zero for no price or no deposit", () => {
    expect(depositFor(0, 30)).toBe(0);
    expect(depositFor(1000, 0)).toBe(0);
    expect(depositFor(1000, Number.NaN)).toBe(0);
  });
  it("allows online payment only in NGN", () => {
    expect(canPayOnline("NGN")).toBe(true);
    expect(canPayOnline("usd")).toBe(false);
  });
});
