import { describe, expect, it } from "vitest";
import { formatDate, formatNumber, normalizeLocale, resolveLocale, FALLBACK_LOCALE } from "@/lib/i18n/locale";
import { currencySymbol, formatMoney, moneyFormatter } from "@/lib/utils/format-money";

describe("locale layer", () => {
  it("defaults to en-NG and survives invalid tags", () => {
    expect(resolveLocale()).toBe(FALLBACK_LOCALE);
    expect(resolveLocale("not a locale!!")).toBe(FALLBACK_LOCALE);
    expect(normalizeLocale("en_GB")).toBe("en-GB");
  });
  it("formatMoney keeps Nigerian output by default and honours an explicit locale", () => {
    expect(formatMoney(5000, "NGN")).toBe("₦5,000");
    expect(formatMoney(1234.5, "EUR", { locale: "de-DE" })).toMatch(/1\.234,50/);
    expect(formatMoney(1500.4, "NGN", { decimals: 0 })).toBe("₦1,500");
  });
  it("formatNumber and formatDate are safe on bad input", () => {
    expect(formatNumber("abc")).toBe("0");
    expect(formatNumber(1234567)).toBe("1,234,567");
    expect(formatDate(undefined)).toBe("");
    expect(formatDate("garbage")).toBe("");
    expect(formatDate("2026-10-25T12:00:00Z", { locale: "en-GB", timeZone: "UTC" })).toBe("25 Oct 2026");
  });
});

describe("currency helpers", () => {
  it("currencySymbol returns the bare symbol", () => {
    expect(currencySymbol()).toBe("₦");
    expect(currencySymbol("NGN")).toBe("₦");
    expect(currencySymbol("not-a-currency")).toBe("NOT-A-CURRENCY");
  });
  it("moneyFormatter binds a store's currency and locale, with safe fallbacks", () => {
    expect(moneyFormatter({ currency: "NGN", locale: null })(2500)).toBe("₦2,500");
    expect(moneyFormatter(null)(2500)).toBe("₦2,500");
    expect(moneyFormatter({ currency: "GBP", locale: "en-GB" })(10)).toBe("£10");
    expect(moneyFormatter({ currency: "NGN" })(10, { decimals: 2 })).toBe("₦10.00");
  });
});

