import { describe, expect, it } from "vitest";
import { findMixedCurrencies, mixedCurrencyMessage } from "@/lib/currency-guard";

describe("findMixedCurrencies", () => {
  it("returns null for a single currency", () => {
    expect(findMixedCurrencies(["NGN", "NGN"])).toBeNull();
    expect(findMixedCurrencies(["NGN"])).toBeNull();
    expect(findMixedCurrencies([])).toBeNull();
  });
  it("treats case and whitespace differences as the same currency (CSV imports don't uppercase)", () => {
    expect(findMixedCurrencies(["NGN", "ngn", " NGN "])).toBeNull();
  });
  it("returns the sorted distinct codes when currencies differ", () => {
    expect(findMixedCurrencies(["USD", "NGN", "usd"])).toEqual(["NGN", "USD"]);
  });
  it("ignores empty values", () => {
    expect(findMixedCurrencies(["NGN", "", null, undefined])).toBeNull();
  });
  it("produces a customer-readable message", () => {
    expect(mixedCurrencyMessage(["NGN", "USD"])).toContain("NGN and USD");
  });
});
