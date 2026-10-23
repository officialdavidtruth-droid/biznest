import { describe, expect, it } from "vitest";
import { normalizeWhatsAppNumber as n, whatsappLink as link } from "@/lib/utils/whatsapp-link";

describe("normalizeWhatsAppNumber", () => {
  it("handles common Nigerian formats", () => {
    for (const v of ["08031234567", "0803 123 4567", "+234 803 123 4567", "+234 (0)803 123 4567", "8031234567", "2348031234567", "002348031234567"]) {
      expect(n(v)).toBe("2348031234567");
    }
  });
  it("keeps other countries and rejects junk", () => {
    expect(n("+44 7911 123456")).toBe("447911123456");
    expect(n("")).toBeNull();
    expect(n("Chat with us on WhatsApp")).toBeNull();
    expect(n("123")).toBeNull();
  });
});

describe("whatsappLink", () => {
  it("builds wa.me links with optional text", () => {
    expect(link("0803 123 4567")).toBe("https://wa.me/2348031234567");
    expect(link("08031234567", "Hi there")).toBe("https://wa.me/2348031234567?text=Hi%20there");
  });
  it("passes WhatsApp URLs through and rejects others", () => {
    expect(link("https://wa.me/2348031234567")).toBe("https://wa.me/2348031234567");
    expect(link("https://evil.example/x")).toBeNull();
    expect(link(null)).toBeNull();
  });
});
