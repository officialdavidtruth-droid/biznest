import { describe, expect, it } from "vitest";
import { DEMO_STORE_SLUG, isDemoStoreSlug } from "@/lib/demo-store";
import { OFFICIAL_SLUG } from "@/lib/browse";
import { ALL_BUSINESS_TYPE_NAMES } from "@/lib/capabilities";
import { RESERVED_SLUGS } from "@/lib/constants/reserved-slugs";

describe("demo store", () => {
  it("is the official BizNest account's store and no other", () => {
    expect(DEMO_STORE_SLUG).toBe(OFFICIAL_SLUG);
    expect(isDemoStoreSlug(OFFICIAL_SLUG)).toBe(true);
    expect(isDemoStoreSlug("some-vendor")).toBe(false);
    expect(isDemoStoreSlug(null)).toBe(false);
  });
  it("cannot be claimed by a vendor", () => {
    expect(RESERVED_SLUGS.has(DEMO_STORE_SLUG)).toBe(true);
  });
  it("has niches to switch between", () => {
    expect(ALL_BUSINESS_TYPE_NAMES.length).toBeGreaterThan(5);
  });
});
