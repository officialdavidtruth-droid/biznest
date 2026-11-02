import { describe, expect, it } from "vitest";
import { canPreorder, formatShipsOn, parsePreorderInput, preorderSpotsLeft } from "@/lib/preorder";

const now = new Date("2026-11-10T12:00:00Z");

describe("pre-order settings", () => {
  it("off clears everything", () => {
    expect(parsePreorderInput({ enabled: false, shipsOn: "2030-01-01", limit: "5" }, now)).toEqual({ ok: true, data: { enabled: false, shipsOn: null, limit: null } });
  });
  it("accepts date and cap, both optional", () => {
    const r = parsePreorderInput({ enabled: true, shipsOn: "2026-12-15", limit: "50" }, now);
    expect(r.ok && r.data.limit).toBe(50);
    expect(r.ok && r.data.shipsOn?.toISOString().slice(0, 10)).toBe("2026-12-15");
    const open = parsePreorderInput({ enabled: true, shipsOn: "", limit: "" }, now);
    expect(open.ok && open.data).toEqual({ enabled: true, shipsOn: null, limit: null });
  });
  it("allows today but not the past", () => {
    expect(parsePreorderInput({ enabled: true, shipsOn: "2026-11-10", limit: "" }, now).ok).toBe(true);
    expect(parsePreorderInput({ enabled: true, shipsOn: "2026-11-09", limit: "" }, now).ok).toBe(false);
  });
  it("rejects bad dates and caps", () => {
    for (const shipsOn of ["tomorrow", "2026-13-40", "12/12/2026"]) expect(parsePreorderInput({ enabled: true, shipsOn, limit: "" }, now).ok).toBe(false);
    for (const limit of ["0", "-3", "2.5", "abc", "100001"]) expect(parsePreorderInput({ enabled: true, shipsOn: "", limit }, now).ok).toBe(false);
  });
});

describe("pre-order cap", () => {
  it("counts spots left", () => {
    expect(preorderSpotsLeft(null, 99)).toBeNull();
    expect(preorderSpotsLeft(10, 4)).toBe(6);
    expect(preorderSpotsLeft(10, 12)).toBe(0);
  });
  it("allows an order only if it fits", () => {
    expect(canPreorder(null, 1000, 5)).toBe(true);
    expect(canPreorder(10, 8, 2)).toBe(true);
    expect(canPreorder(10, 8, 3)).toBe(false);
    expect(canPreorder(10, 10, 1)).toBe(false);
  });
  it("formats the ship date", () => {
    expect(formatShipsOn(null)).toBeNull();
    expect(formatShipsOn("not a date")).toBeNull();
    expect(formatShipsOn(new Date("2026-12-15T00:00:00Z"))).toContain("2026");
  });
});
