import { describe, expect, it } from "vitest";
import { growthToolsAllowed, staffLimitFor } from "../plan-limits";

describe("staffLimitFor", () => {
  it("follows the template tier by default", () => {
    expect(staffLimitFor({ templateTier: 2 })).toBe(2);
    expect(staffLimitFor({ templateTier: 3 })).toBe(5);
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
