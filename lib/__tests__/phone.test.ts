import { describe, expect, it } from "vitest";
import { canonicalPhone, phoneKey, phoneVariants } from "@/lib/phone";

describe("phoneKey", () => {
  it("treats every written form of a Nigerian number as the same", () => {
    const forms = ["08031234567", "0803 123 4567", "+2348031234567", "+234 803 123 4567", "2348031234567", "002348031234567", "8031234567", "0803-123-4567"];
    for (const f of forms) expect(phoneKey(f)).toBe("8031234567");
  });
  it("keeps different numbers different", () => {
    expect(phoneKey("08031234567")).not.toBe(phoneKey("08031234568"));
  });
  it("keeps foreign numbers whole and ignores too-short input", () => {
    expect(phoneKey("+1 415 555 0123")).toBe("14155550123");
    expect(phoneKey("12345")).toBeNull();
    expect(phoneKey(null)).toBeNull();
    expect(phoneKey("   ")).toBeNull();
  });
});

describe("canonicalPhone / phoneVariants", () => {
  it("stores Nigerian numbers as +234 and leaves others as typed", () => {
    expect(canonicalPhone("0803 123 4567")).toBe("+2348031234567");
    expect(canonicalPhone(" +1 415 555 0123 ")).toBe("+1 415 555 0123");
    expect(canonicalPhone("")).toBeNull();
  });
  it("lists every plain form for database lookups", () => {
    const v = phoneVariants("08031234567");
    for (const f of ["08031234567", "+2348031234567", "2348031234567", "8031234567"]) expect(v).toContain(f);
  });
});
