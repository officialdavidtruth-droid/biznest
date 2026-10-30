import { describe, expect, it } from "vitest";
import { parseRatesResponse, crossRate, convertAmount, currencyDigits } from "@/lib/fx/convert";

const good = { result: "success", time_last_update_utc: "Fri, 30 Oct 2026 00:00:01 +0000", rates: { USD: 1, NGN: 1500, GBP: 0.8, JPY: 150, BAD: -1, xx: 3, EUR: "1" } };

describe("parseRatesResponse", () => {
  it("keeps valid 3-letter positive numeric rates and drops junk", () => {
    const r = parseRatesResponse(good)!;
    expect(r.rates).toEqual({ USD: 1, NGN: 1500, GBP: 0.8, JPY: 150 });
    expect(r.updatedAt).toContain("2026");
  });
  it("rejects failures, malformed payloads and tables without USD", () => {
    expect(parseRatesResponse({ result: "error", rates: {} })).toBeNull();
    expect(parseRatesResponse(null)).toBeNull();
    expect(parseRatesResponse({ result: "success", rates: { NGN: 1500 } })).toBeNull();
    expect(parseRatesResponse({ result: "success" })).toBeNull();
  });
});

describe("crossRate / convertAmount", () => {
  const rates = parseRatesResponse(good)!.rates;
  it("converts between two non-USD currencies via the USD table", () => {
    expect(crossRate(rates, "NGN", "GBP")).toBeCloseTo(0.8 / 1500, 10);
    expect(crossRate(rates, "ngn", "usd")).toBeCloseTo(1 / 1500, 10);
  });
  it("returns null for an unknown currency", () => {
    expect(crossRate(rates, "NGN", "ZZZ")).toBeNull();
  });
  it("rounds to the target currency's decimals", () => {
    expect(currencyDigits("USD")).toBe(2);
    expect(currencyDigits("JPY")).toBe(0);
    expect(convertAmount(30000, 1 / 1500, "USD")).toBe(20);
    expect(convertAmount(5000, 150 / 1500, "JPY")).toBe(500);
    expect(convertAmount(1234, 1 / 1500, "USD")).toBe(0.82);
  });
});
