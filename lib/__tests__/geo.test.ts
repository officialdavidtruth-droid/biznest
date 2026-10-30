import { describe, expect, it } from "vitest";
import { COUNTRIES, getStatesForCountry, isValidCountry, isValidStateForCountry, normalizeSearch } from "@/lib/geo";
import { businessVerificationSchema } from "@/lib/validations/business";

const base = {
  businessName: "Fruitzy", category: "Other", description: "Fresh fruit and juices delivered daily.", phone: "08012345678",
  email: "a@b.co", city: "Abuja", sellsProducts: true, offersServices: false,
  registrationType: "REGISTERED" as const, registrationCertUrl: "https://example.com/cert.pdf",
};

describe("geo", () => {
  it("has the countries and Nigeria's 36 states + FCT", async () => {
    expect(COUNTRIES.length).toBeGreaterThan(240);
    expect(isValidCountry("Nigeria")).toBe(true);
    const ng = await getStatesForCountry("Nigeria");
    expect(ng).toHaveLength(37);
    expect(ng).toContain("Lagos");
    expect(ng).toContain("Abuja (FCT)");
  });
  it("states depend on country", async () => {
    expect(await isValidStateForCountry("Nigeria", "Lagos")).toBe(true);
    expect(await isValidStateForCountry("Nigeria", "Texas")).toBe(false);
    expect(await isValidStateForCountry("United States", "Texas")).toBe(true);
    expect(await isValidStateForCountry("Ghana", "Lagos")).toBe(false);
  });
  it("search is accent- and case-insensitive", () => {
    expect(normalizeSearch("  Côte d’Ivoire ")).toBe("cote d’ivoire");
  });
  it("schema rejects unknown countries", () => {
    expect(businessVerificationSchema.safeParse({ ...base, country: "Nigeria", state: "Lagos" }).success).toBe(true);
    expect(businessVerificationSchema.safeParse({ ...base, country: "Narnia", state: "Lagos" }).success).toBe(false);
  });
});
