import { describe, expect, it } from "vitest";
import { ALL_BUSINESS_TYPE_NAMES } from "@/lib/capabilities";
import { COMING_SOON_BUSINESS_TYPES, businessTypeLabel, isComingSoonBusinessType } from "@/lib/business-type-status";

describe("business type status", () => {
  it("only lists real business types", () => {
    for (const t of COMING_SOON_BUSINESS_TYPES) expect(ALL_BUSINESS_TYPE_NAMES).toContain(t);
  });
  it("labels and detects by name, ignoring case", () => {
    expect(isComingSoonBusinessType(null)).toBe(false);
    expect(isComingSoonBusinessType("Restaurant")).toBe(COMING_SOON_BUSINESS_TYPES.includes("Restaurant"));
    for (const t of COMING_SOON_BUSINESS_TYPES) {
      expect(isComingSoonBusinessType(t.toUpperCase())).toBe(true);
      expect(businessTypeLabel(t)).toBe(`${t} (coming soon)`);
    }
    expect(businessTypeLabel("Not a listed type")).toBe("Not a listed type");
  });
});
