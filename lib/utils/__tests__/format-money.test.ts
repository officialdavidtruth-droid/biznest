import { describe, expect, it } from "vitest";
import { formatMoney } from "@/lib/utils/format-money";
import { storeHref } from "@/lib/utils/store-href";

describe("formatMoney", () => {
  it("formats naira with the ₦ symbol and no decimals for whole amounts", () => {
    expect(formatMoney(5000, "NGN")).toBe("₦5,000");
    expect(formatMoney(1234567)).toBe("₦1,234,567");
  });
  it("keeps kobo when present", () => { expect(formatMoney(1500.5, "NGN")).toBe("₦1,500.50"); });
  it("uses the real currency instead of assuming naira", () => { expect(formatMoney(50, "USD")).toContain("50"); expect(formatMoney(50, "USD")).not.toContain("₦"); });
  it("is safe on bad input", () => {
    expect(formatMoney(undefined)).toBe("₦0");
    expect(formatMoney("abc", "NGN")).toBe("₦0");
    expect(() => formatMoney(10, "not-a-currency")).not.toThrow();
  });
  it("accepts numeric strings and null currency", () => { expect(formatMoney("2500", null)).toBe("₦2,500"); });
});
describe("storeHref", () => { it("builds store paths", () => { expect(storeHref("acme")).toBe("/store/acme"); expect(storeHref("acme", "/cart")).toBe("/store/acme/cart"); }); });
