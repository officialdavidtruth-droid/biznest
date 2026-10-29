import { describe, expect, it } from "vitest";
import { manualPayInfoFromStore, manualPayReady, normalizeWhatsapp, whatsappLink } from "@/lib/payments/manual-transfer";

describe("normalizeWhatsapp", () => {
  it("turns local Nigerian numbers into international digits", () => {
    expect(normalizeWhatsapp("0801 234 5678")).toBe("2348012345678");
    expect(normalizeWhatsapp("08012345678")).toBe("2348012345678");
  });
  it("keeps numbers that are already international", () => {
    expect(normalizeWhatsapp("+234 801 234 5678")).toBe("2348012345678");
    expect(normalizeWhatsapp("+44 7700 900123")).toBe("447700900123");
    expect(normalizeWhatsapp("00233 24 123 4567")).toBe("233241234567");
  });
  it("rejects junk", () => {
    expect(normalizeWhatsapp("")).toBeNull();
    expect(normalizeWhatsapp(null)).toBeNull();
    expect(normalizeWhatsapp("abc")).toBeNull();
    expect(normalizeWhatsapp("12345")).toBeNull();
    expect(normalizeWhatsapp("+1234567890123456")).toBeNull();
  });
});

describe("whatsappLink", () => {
  it("builds a wa.me link with an encoded message", () => {
    expect(whatsappLink("08012345678", "Hi there")).toBe("https://wa.me/2348012345678?text=Hi%20there");
    expect(whatsappLink("08012345678")).toBe("https://wa.me/2348012345678");
    expect(whatsappLink("nope")).toBeNull();
  });
});

describe("manualPayInfoFromStore / manualPayReady", () => {
  const full = { manualBankName: "GTBank", manualAccountName: "Ada Stores", manualAccountNumber: "0123456789", whatsappNumber: "2348012345678" };

  it("is ready only with bank, account name and number, and enabled", () => {
    expect(manualPayReady(manualPayInfoFromStore(full))).toBe(true);
    expect(manualPayReady(manualPayInfoFromStore({ ...full, manualPayEnabled: false }))).toBe(false);
    expect(manualPayReady(manualPayInfoFromStore({ ...full, manualAccountNumber: " " }))).toBe(false);
    expect(manualPayReady(manualPayInfoFromStore({}))).toBe(false);
  });

  it("defaults to enabled when the flag is unset", () => {
    expect(manualPayInfoFromStore(full).enabled).toBe(true);
  });

  it("prefers the dedicated WhatsApp number, then social link, then contact phone", () => {
    expect(manualPayInfoFromStore({ ...full, socialLinks: { whatsapp: "08099999999" }, contactPhone: "08011111111" }).whatsapp).toBe("2348012345678");
    expect(manualPayInfoFromStore({ socialLinks: { whatsapp: "08099999999" }, contactPhone: "08011111111" }).whatsapp).toBe("2348099999999");
    expect(manualPayInfoFromStore({ contactPhone: "08011111111" }).whatsapp).toBe("2348011111111");
    expect(manualPayInfoFromStore({}).whatsapp).toBeNull();
  });
});
