import { describe, expect, it } from "vitest";
import { growthToolsAllowed, minPlanNameFor, planAllows, staffLimitFor } from "../plan-limits";

describe("staffLimitFor", () => {
  it("follows the plan rank by default", () => {
    expect(staffLimitFor({ templateTier: 1 })).toBe(1);
    expect(staffLimitFor({ templateTier: 2 })).toBe(3);
    expect(staffLimitFor({ templateTier: 3 })).toBe(20);
    expect(staffLimitFor({ templateTier: 4 })).toBe(20);
  });
  it("fails open for a plan with no tier", () => {
    expect(staffLimitFor({})).toBe(20);
    expect(staffLimitFor(null)).toBe(20);
  });
  it("lets an explicit value win, including unlimited", () => {
    expect(staffLimitFor({ templateTier: 2, staff: 10 })).toBe(10);
    expect(staffLimitFor({ templateTier: 2, staff: -1 })).toBe(-1);
  });
});

describe("growthToolsAllowed", () => {
  it("blocks the entry tier and allows higher tiers", () => {
    expect(growthToolsAllowed({ templateTier: 2 })).toBe(false);
    expect(growthToolsAllowed({ templateTier: 3 })).toBe(true);
    expect(growthToolsAllowed({ templateTier: 4 })).toBe(true);
  });
  it("fails open without a tier", () => {
    expect(growthToolsAllowed({})).toBe(true);
  });
  it("lets an explicit flag win", () => {
    expect(growthToolsAllowed({ templateTier: 2, growthTools: true })).toBe(true);
    expect(growthToolsAllowed({ templateTier: 4, growthTools: false })).toBe(false);
  });
});

describe("planAllows", () => {
  it("keeps POS, invoices and quotes off the entry plan", () => {
    expect(planAllows({ templateTier: 1 }, "pos")).toBe(false);
    expect(planAllows({ templateTier: 1 }, "invoices")).toBe(false);
    expect(planAllows({ templateTier: 1 }, "quotes")).toBe(false);
    expect(planAllows({ templateTier: 2 }, "pos")).toBe(true);
  });
  it("keeps ads and webhooks for the top plan", () => {
    expect(planAllows({ templateTier: 2 }, "ads")).toBe(false);
    expect(planAllows({ templateTier: 2 }, "webhooks")).toBe(false);
    expect(planAllows({ templateTier: 3 }, "ads")).toBe(true);
    expect(planAllows({ templateTier: 4 }, "webhooks")).toBe(true);
  });
  it("fails open for a plan with no tier", () => {
    expect(planAllows({}, "ads")).toBe(true);
    expect(planAllows(null, "pos")).toBe(true);
  });
  it("names the cheapest plan that includes a tool", () => {
    expect(minPlanNameFor("pos")).toBe("Entrepreneurship");
    expect(minPlanNameFor("ads")).toBe("Business Mogul");
  });
});

describe("plan rank follows the plan name", () => {
  it("ignores drifted templateTier numbers when the name is one of the three plans", () => {
    expect(staffLimitFor({ templateTier: 2 }, "Starters")).toBe(1);
    expect(planAllows({ templateTier: 2 }, "pos", "Starters")).toBe(false);
    expect(planAllows({ templateTier: 3 }, "ads", "Entrepreneurship")).toBe(false);
    expect(planAllows({ templateTier: 3 }, "ads", "Business Mogul")).toBe(true);
    expect(growthToolsAllowed({ templateTier: 4 }, "Entrepreneurship")).toBe(false);
  });
});
