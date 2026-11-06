import { describe, expect, it } from "vitest";
import { canMove, isOpen, jobNumber, lastJobSeq, newDeliveryPin, pinMatches, riderCashOwed, sanitizeJob } from "@/lib/dispatch";

describe("job numbers and pins", () => {
  it("formats and continues the sequence", () => {
    expect(jobNumber(42)).toBe("DLV-00042");
    expect(lastJobSeq(["DLV-00003", "DLV-00010", "junk", null])).toBe(10);
    expect(lastJobSeq([])).toBe(0);
  });
  it("makes 4-digit pins that match only exactly", () => {
    for (let i = 0; i < 200; i++) expect(newDeliveryPin()).toMatch(/^\d{4}$/);
    expect(pinMatches("0420", " 0420 ")).toBe(true);
    expect(pinMatches("0420", "420")).toBe(false);
    expect(pinMatches("0420", "0421")).toBe(false);
    expect(pinMatches("0420", undefined)).toBe(false);
  });
});

describe("status moves", () => {
  it("allows the normal path and blocks shortcuts", () => {
    expect(canMove("NEW", "ASSIGNED")).toBe(true);
    expect(canMove("ASSIGNED", "PICKED_UP")).toBe(true);
    expect(canMove("PICKED_UP", "DELIVERED")).toBe(true);
    expect(canMove("NEW", "DELIVERED")).toBe(false);
    expect(canMove("DELIVERED", "NEW")).toBe(false);
    expect(canMove("CANCELLED", "NEW")).toBe(false);
    expect(canMove("FAILED", "NEW")).toBe(true);
    expect(canMove("x", "NEW")).toBe(false);
    expect(isOpen("PICKED_UP")).toBe(true);
    expect(isOpen("DELIVERED")).toBe(false);
  });
});

describe("sanitizeJob", () => {
  const base = { customerName: "Test Person", pickupAddress: "1 A St", dropoffAddress: "2 B St" };
  it("requires name and both addresses", () => {
    expect(sanitizeJob({ ...base, customerName: "" })).toMatchObject({ ok: false });
    expect(sanitizeJob({ ...base, pickupAddress: "" })).toMatchObject({ ok: false });
    expect(sanitizeJob({ ...base, dropoffAddress: " " })).toMatchObject({ ok: false });
  });
  it("validates contacts and money", () => {
    expect(sanitizeJob({ ...base, customerPhone: "12" })).toMatchObject({ ok: false });
    expect(sanitizeJob({ ...base, customerEmail: "nope" })).toMatchObject({ ok: false });
    expect(sanitizeJob({ ...base, fee: -5 })).toMatchObject({ ok: false });
    expect(sanitizeJob({ ...base, codAmount: "x" })).toMatchObject({ ok: false });
    expect(sanitizeJob({ ...base, customerPhone: "0801 000 0000", fee: "1,500", codAmount: 20000 })).toMatchObject({ ok: true, job: { customerPhone: "08010000000", fee: 1500, codAmount: 20000 } });
  });
});

describe("riderCashOwed", () => {
  it("counts only delivered, un-remitted cash jobs per rider", () => {
    const m = riderCashOwed([
      { riderId: "r1", status: "DELIVERED", codAmount: 5000, codRemittedAt: null },
      { riderId: "r1", status: "DELIVERED", codAmount: 2500, codRemittedAt: null },
      { riderId: "r1", status: "DELIVERED", codAmount: 9000, codRemittedAt: new Date() },
      { riderId: "r1", status: "PICKED_UP", codAmount: 1000, codRemittedAt: null },
      { riderId: "r2", status: "DELIVERED", codAmount: 0, codRemittedAt: null },
      { riderId: null, status: "DELIVERED", codAmount: 100, codRemittedAt: null },
    ]);
    expect(m.get("r1")).toEqual({ owed: 7500, jobs: 2 });
    expect(m.has("r2")).toBe(false);
  });
});
