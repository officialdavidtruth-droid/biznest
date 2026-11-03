import { describe, expect, it } from "vitest";
import { businessAddress, businessEmail, businessHours, businessPhone, normalizeSocialLink } from "../storefront/business-details";

describe("business detail helpers", () => {
  it("prefers what the owner typed, then older fields, then the business profile", () => {
    expect(businessPhone({ contactPhone: "0803 111", phone: "x", business: { phone: "y" } })).toBe("0803 111");
    expect(businessPhone({ contactPhone: " ", business: { phone: "0701 222" } })).toBe("0701 222");
    expect(businessEmail({ contactEmail: null, email: null, business: { email: "a@b.com" } })).toBe("a@b.com");
  });
  it("uses the typed address, else City, State", () => {
    expect(businessAddress({ address: "12 Market Rd", business: { city: "Abuja", state: "FCT" } })).toBe("12 Market Rd");
    expect(businessAddress({ business: { city: "Abuja", state: "FCT" } })).toBe("Abuja, FCT");
    expect(businessAddress({ business: { city: "Abuja", state: null } })).toBe("Abuja");
  });
  it("returns an empty string when there is nothing, so templates can show their own wording", () => {
    expect(businessPhone(undefined)).toBe("");
    expect(businessEmail(null)).toBe("");
    expect(businessAddress({})).toBe("");
    expect(businessHours({ openingHours: "  " })).toBe("");
    expect(businessHours({ openingHours: "Mon-Sat 9-6" })).toBe("Mon-Sat 9-6");
  });
});

describe("normalizeSocialLink", () => {
  it("turns a handle into a full link", () => {
    expect(normalizeSocialLink("instagram", "@mybakery")).toBe("https://instagram.com/mybakery");
    expect(normalizeSocialLink("tiktok", "mybakery")).toBe("https://tiktok.com/@mybakery");
    expect(normalizeSocialLink("twitter", "mybakery")).toBe("https://x.com/mybakery");
  });
  it("keeps a pasted link and treats blank as empty", () => {
    expect(normalizeSocialLink("facebook", "https://facebook.com/mybakery")).toBe("https://facebook.com/mybakery");
    expect(normalizeSocialLink("facebook", "   ")).toBe("");
  });
  it("rejects anything unsafe or unusable", () => {
    expect(normalizeSocialLink("instagram", "javascript:alert(1)")).toBeNull();
    expect(normalizeSocialLink("instagram", "my bakery!")).toBeNull();
    expect(normalizeSocialLink("facebook", "https://user:pw@facebook.com/x")).toBeNull();
  });
});
