import { describe, expect, it } from "vitest";
import { roomingGroups, manifestIssues, type ManifestRow } from "@/lib/travel";

const row = (o: Partial<ManifestRow>): ManifestRow => ({
  travelerId: "t", tripId: "x", tripReference: "TRV-2611-0001", tripStatus: "CONFIRMED", fullName: "A B", isLead: false, gender: null,
  passportNo: "A1", passportExpiry: "2035-01-01T00:00:00.000Z", dateOfBirth: "1990-01-01T00:00:00.000Z", nationality: "Nigerian",
  roomType: null, roomLabel: null, requests: null, contactName: "C", contactPhone: null, ...o,
});

describe("roomingGroups", () => {
  it("groups by label ignoring case and spacing, and lists unroomed travellers", () => {
    const g = roomingGroups([row({ travelerId: "1", roomLabel: "201", roomType: "DOUBLE" }), row({ travelerId: "2", roomLabel: " 201 ", roomType: "DOUBLE" }), row({ travelerId: "3" })]);
    expect(g.rooms).toHaveLength(1);
    expect(g.rooms[0].members).toHaveLength(2);
    expect(g.unassigned.map((x) => x.travelerId)).toEqual(["3"]);
    expect(g.rooms[0].problems).toEqual([]);
  });
  it("flags over capacity, mixed types and mixed genders", () => {
    const over = roomingGroups([1, 2, 3].map((n) => row({ travelerId: String(n), roomLabel: "5", roomType: "DOUBLE" })));
    expect(over.rooms[0].problems.join()).toContain("Over capacity");
    const mixedType = roomingGroups([row({ roomLabel: "6", roomType: "SINGLE" }), row({ roomLabel: "6", roomType: "TWIN" })]);
    expect(mixedType.rooms[0].problems).toContain("Mixed room types");
    const mixedSex = roomingGroups([row({ roomLabel: "7", roomType: "TWIN", gender: "M" }), row({ roomLabel: "7", roomType: "TWIN", gender: "F" })]);
    expect(mixedSex.rooms[0].problems).toContain("Mixed genders in one room");
  });
  it("sorts room labels naturally", () => {
    const g = roomingGroups([row({ roomLabel: "10" }), row({ roomLabel: "2" })]);
    expect(g.rooms.map((r) => r.label)).toEqual(["2", "10"]);
  });
});

describe("manifestIssues", () => {
  it("reports missing passport, dob and short validity", () => {
    expect(manifestIssues(row({ passportNo: null, passportExpiry: null, dateOfBirth: null }), "2027-01-01")).toEqual(["No passport number", "No date of birth"]);
    expect(manifestIssues(row({ passportExpiry: "2027-03-01T00:00:00.000Z" }), "2027-01-01")).toContain("Passport valid for under 6 months at travel");
    expect(manifestIssues(row({}), "2027-01-01")).toEqual([]);
  });
});

import { supplierBalances } from "@/lib/travel";
describe("supplierBalances", () => {
  it("nets payments off cost per supplier and currency, ignoring void payments", () => {
    const b = supplierBalances(
      [{ supplierId: "a", currency: "NGN", cost: 100000.1 }, { supplierId: "a", currency: "NGN", cost: 50000 }, { supplierId: "a", currency: "USD", cost: 300 }, { supplierId: "b", currency: "NGN", cost: 10 }],
      [{ supplierId: "a", currency: "NGN", amount: 60000, status: "RECORDED" }, { supplierId: "a", currency: "NGN", amount: 99999, status: "VOID" }],
    );
    const a = b.find((x) => x.supplierId === "a" && x.currency === "NGN")!;
    expect(a).toMatchObject({ owed: 150000.1, paid: 60000, outstanding: 90000.1 });
    expect(b.find((x) => x.supplierId === "a" && x.currency === "USD")!.outstanding).toBe(300);
    expect(b).toHaveLength(3);
  });
  it("shows a credit when paid exceeds what is now owed", () => {
    expect(supplierBalances([], [{ supplierId: "a", currency: "NGN", amount: 500, status: "RECORDED" }])[0].outstanding).toBe(-500);
  });
});

import { commissionFor } from "@/lib/travel";
describe("commissionFor", () => {
  const trip = { status: "CONFIRMED", totalPrice: 1000000, totalCost: 700000 };
  it("is zero before confirmation and after cancellation", () => {
    expect(commissionFor({ ...trip, status: "QUOTED" }, [], 10, "SELL")).toEqual({ earned: 0, releasable: 0 });
    expect(commissionFor({ ...trip, status: "CANCELLED" }, [], 10, "SELL")).toEqual({ earned: 0, releasable: 0 });
  });
  it("uses selling price or margin as the basis", () => {
    expect(commissionFor(trip, [], 5, "SELL").earned).toBe(50000);
    expect(commissionFor(trip, [], 10, "MARGIN").earned).toBe(30000);
    expect(commissionFor({ ...trip, totalCost: 1200000 }, [], 10, "MARGIN").earned).toBe(0);
  });
  it("releases commission in proportion to money collected, net of refunds", () => {
    const pays = [{ amount: 400000, status: "RECEIVED", refundedAmount: 0 }, { amount: 100000, status: "RECEIVED", refundedAmount: 100000 }];
    expect(commissionFor(trip, pays, 10, "SELL")).toEqual({ earned: 100000, releasable: 40000 });
  });
});
