import { describe, expect, it } from "vitest";
import { currencyForCountry, resolveStoreCurrency, isGatewayChargeable } from "@/lib/store-currency";

describe("store currency from country", () => {
  it("maps countries to their currency", () => {
    expect(currencyForCountry("Nigeria")).toBe("NGN");
    expect(currencyForCountry("United States")).toBe("USD");
    expect(currencyForCountry("United Kingdom")).toBe("GBP");
    expect(currencyForCountry("Ghana")).toBe("GHS");
  });
  it("maps eurozone and CFA countries to the shared currency", () => {
    expect(currencyForCountry("Germany")).toBe("EUR");
    expect(currencyForCountry("France")).toBe("EUR");
    expect(currencyForCountry("Senegal")).toBe("XOF");
    expect(currencyForCountry("Cameroon")).toBe("XAF");
  });
  it("returns null for unmapped or unknown countries, and resolve falls back to NGN", () => {
    expect(currencyForCountry("Atlantis")).toBeNull();
    expect(currencyForCountry(undefined)).toBeNull();
    expect(resolveStoreCurrency("Atlantis")).toBe("NGN");
    expect(resolveStoreCurrency("Vietnam")).toBe("NGN");
  });
});

describe("gateway chargeable currencies", () => {
  it("allows only NGN today, case-insensitively", () => {
    expect(isGatewayChargeable("NGN")).toBe(true);
    expect(isGatewayChargeable("ngn")).toBe(true);
    expect(isGatewayChargeable("USD")).toBe(false);
    expect(isGatewayChargeable(undefined)).toBe(false);
  });
});

import { currencyForCountryCode } from "@/lib/store-currency";
describe("currencyForCountryCode", () => {
  it("maps browser-locale regions", () => {
    expect(currencyForCountryCode("US")).toBe("USD");
    expect(currencyForCountryCode("gb")).toBe("GBP");
    expect(currencyForCountryCode("DE")).toBe("EUR");
    expect(currencyForCountryCode("ZZ")).toBeNull();
    expect(currencyForCountryCode(undefined)).toBeNull();
  });
});
