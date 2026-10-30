import { describe, expect, it } from "vitest";
import { ALL_BUSINESS_TYPE_NAMES } from "@/lib/capabilities";
import { BUSINESS_SUBCATEGORIES, categoryHasSubcategories, getSubcategoryOption, isValidSubcategory } from "@/lib/business-subcategories";
import { businessVerificationSchema } from "@/lib/validations/business";
import { getBusinessOnboardingPlan } from "@/lib/onboarding-business";
import { isCreativeText } from "@/lib/storefront-niche";
import { hotelHasDining } from "@/lib/hotel-dining";

const base = {
  businessName: "Fruitzy", description: "Fresh fruit and juices delivered daily.", phone: "08012345678",
  email: "a@b.co", country: "Nigeria", state: "FCT", city: "Abuja", sellsProducts: true, offersServices: false,
  registrationType: "REGISTERED" as const, registrationCertUrl: "https://example.com/cert.pdf",
};

describe("business subcategories", () => {
  it("every selectable category has a specialty list", () => {
    for (const c of ALL_BUSINESS_TYPE_NAMES) expect(categoryHasSubcategories(c), c).toBe(true);
    expect(categoryHasSubcategories("Other")).toBe(false);
  });

  it("option names are unique within a category and ids are unique", () => {
    for (const [c, cfg] of Object.entries(BUSINESS_SUBCATEGORIES)) {
      expect(new Set(cfg.options.map((x) => x.name)).size, c).toBe(cfg.options.length);
      expect(new Set(cfg.options.map((x) => x.id)).size, c).toBe(cfg.options.length);
      for (const x of cfg.options) {
        expect(x.name.length, x.name).toBeLessThanOrEqual(120);
        expect(x.recommendations.length, x.name).toBeGreaterThan(0);
      }
    }
  });

  it("no non-photography option trips the creative keyword heuristic", () => {
    for (const [c, cfg] of Object.entries(BUSINESS_SUBCATEGORIES)) {
      if (c === "Photography" || c === "Professional Services") continue;
      for (const x of cfg.options) expect(isCreativeText(x.name), `${c} / ${x.name}`).toBe(false);
    }
  });

  it("hotel options never flip hotelHasDining on their own", () => {
    for (const x of BUSINESS_SUBCATEGORIES["Hotel & Lodging"].options) {
      expect(hotelHasDining({ category: "Hotel & Lodging", subcategory: x.name }), x.name).toBe(false);
    }
  });

  it("requires a specialty for categories that have one", () => {
    expect(businessVerificationSchema.safeParse({ ...base, category: "Food & Groceries" }).success).toBe(false);
    expect(businessVerificationSchema.safeParse({ ...base, category: "Food & Groceries", businessSubcategory: "Fruits, Juices & Smoothies" }).success).toBe(true);
  });

  it("rejects a specialty from another category", () => {
    expect(businessVerificationSchema.safeParse({ ...base, category: "Fashion", businessSubcategory: "Legal Services" }).success).toBe(false);
    expect(isValidSubcategory("Fashion", "Legal Services")).toBe(false);
  });

  it("still accepts Professional Services specialties and 'Other' with none", () => {
    expect(businessVerificationSchema.safeParse({ ...base, category: "Professional Services", businessSubcategory: "Legal Services" }).success).toBe(true);
    expect(businessVerificationSchema.safeParse({ ...base, category: "Other" }).success).toBe(true);
  });

  it("onboarding plan uses the specialty's recommendations and example text", () => {
    const opt = getSubcategoryOption("Fashion", "Footwear")!;
    const plan = getBusinessOnboardingPlan("Fashion", true, false, "Footwear");
    expect(plan.recommendations).toEqual(opt.recommendations);
    expect(plan.fields[0].placeholder).toContain(opt.focus);
    expect(getBusinessOnboardingPlan("Fashion", true, false, null).recommendations).not.toEqual(opt.recommendations);
  });
});
