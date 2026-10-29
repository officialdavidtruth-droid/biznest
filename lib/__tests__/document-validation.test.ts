import { describe, expect, it } from "vitest";
import { cleanLines, MAX_AMOUNT, parseOptionalDate, validateContact, validateLines, validateOptionalAmount } from "@/lib/utils/document-validation";

const line = { description: "Logo design", quantity: 1, unitPrice: 50000 };

describe("validateLines", () => {
  it("accepts a normal line", () => expect(validateLines([line])).toBeNull());
  it("rejects an empty list", () => expect(validateLines([])).not.toBeNull());
  it("rejects blank descriptions", () => expect(validateLines([{ ...line, description: "   " }])).not.toBeNull());
  it("rejects zero, negative and fractional quantities", () => {
    for (const quantity of [0, -1, 1.5, NaN]) expect(validateLines([{ ...line, quantity }])).not.toBeNull();
  });
  it("rejects negative, non-finite and oversized prices", () => {
    for (const unitPrice of [-1, NaN, Infinity, MAX_AMOUNT + 1]) expect(validateLines([{ ...line, unitPrice }])).not.toBeNull();
  });
  it("allows a free line", () => expect(validateLines([line, { ...line, unitPrice: 0 }])).toBeNull());
});

describe("other validators", () => {
  it("trims descriptions", () => expect(cleanLines([{ ...line, description: "  x  " }])[0].description).toBe("x"));
  it("optional amounts", () => {
    expect(validateOptionalAmount("Tax", undefined)).toBeNull();
    expect(validateOptionalAmount("Tax", 0)).toBeNull();
    expect(validateOptionalAmount("Tax", -5)).not.toBeNull();
  });
  it("contact", () => {
    expect(validateContact({ customerEmail: "a@b.co" })).toBeNull();
    expect(validateContact({ customerEmail: "not-an-email" })).not.toBeNull();
    expect(validateContact({ customerName: "x".repeat(121) })).not.toBeNull();
  });
  it("dates", () => {
    expect(parseOptionalDate(undefined)).toEqual({ ok: true, date: null });
    expect(parseOptionalDate("garbage").ok).toBe(false);
    expect(parseOptionalDate("2026-12-01").ok).toBe(true);
  });
});
