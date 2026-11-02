import { describe, expect, it } from "vitest";
import { canonicalizeBusinessType, CANONICAL_BUSINESS_TYPES } from "@/lib/business-identity";
import { ALL_BUSINESS_TYPE_NAMES, BUSINESS_TYPES, getBusinessTypeConfig } from "@/lib/capabilities";
import { BUSINESS_SUBCATEGORIES, isValidSubcategory } from "@/lib/business-subcategories";
import { getSpecialtyProfile } from "@/lib/specialty-profiles";
import { getAdaptiveDashboardConfig } from "@/lib/adaptive-dashboard";
import { PLAYBOOK_FOR_TYPE } from "@/lib/playbook-meta";
import { getBusinessOnboardingPlan } from "@/lib/onboarding-business";

const TYPE = "HR & Recruitment";

describe("HR & Recruitment business type", () => {
  it("is registered everywhere a type must be", () => {
    expect(CANONICAL_BUSINESS_TYPES).toContain(TYPE);
    expect(BUSINESS_TYPES[TYPE]).toBeDefined();
    expect(ALL_BUSINESS_TYPE_NAMES).toContain(TYPE);
    expect(PLAYBOOK_FOR_TYPE[TYPE]).toBe("services");
  });

  it("canonicalizes common spellings", () => {
    for (const v of ["hr", "HR", "recruitment", "Staffing", "staffing agency", "human resources", "HR and Recruitment", "hr & recruitment"]) {
      expect(canonicalizeBusinessType(v), v).toBe(TYPE);
    }
    expect(canonicalizeBusinessType("random thing")).toBe("Other");
  });

  it("is a services business with bookings and no product catalog", () => {
    const c = getBusinessTypeConfig(TYPE);
    expect(c.capabilities).toContain("services");
    expect(c.capabilities).not.toContain("products");
    expect(c.defaultCategories.every((x) => x.type === "SERVICE")).toBe(true);
    expect(c.quickActions.some((a) => a.href === "/apps/hr-payroll")).toBe(true);
  });

  it("every specialty is valid and resolves to a specialty profile", () => {
    const options = BUSINESS_SUBCATEGORIES[TYPE].options;
    expect(options.length).toBeGreaterThanOrEqual(5);
    for (const o of options) {
      expect(isValidSubcategory(TYPE, o.name), o.name).toBe(true);
      expect(getSpecialtyProfile(TYPE, o.name), o.name).not.toBeNull();
    }
    expect(getSpecialtyProfile(TYPE, "Temporary & Contract Staffing")?.label).toBe("Contract Staffing");
    expect(getSpecialtyProfile(TYPE, "Recruitment & Staffing")?.label).toBe("Recruitment Operations");
  });

  it("builds a dashboard with client/engagement wording", () => {
    const d = getAdaptiveDashboardConfig(TYPE, "HR Consulting");
    expect(d.businessType).toBe(TYPE);
    expect(d.terminology.customer).toBe("Client");
  });

  it("has its own onboarding plan", () => {
    const plan = getBusinessOnboardingPlan(TYPE, false, true, null);
    expect(plan.eyebrow).toBe("Recruitment & HR setup");
  });
});
