import { describe, expect, it, vi } from "vitest";
vi.mock("@/lib/prisma", () => ({ prisma: {} }));
import { usesTailoring } from "@/lib/tailoring-eligibility";
import { isStorePageAvailable } from "@/lib/store-pages";

describe("tailoring follows the Fashion specialty", () => {
  it("is off for shops that only sell", () => {
    for (const s of ["Clothing & Apparel", "Footwear", "Bags & Accessories", "Jewellery & Watches", "Thrift & Pre-owned", "Kids & Baby Fashion", "Fabrics & Materials", "Uniforms & Corporate Wear"]) {
      expect(usesTailoring("Fashion", s)).toBe(false);
    }
  });
  it("is on for tailors and native wear", () => {
    expect(usesTailoring("Fashion", "Tailoring & Bespoke")).toBe(true);
    expect(usesTailoring("Fashion", "Traditional & Native Wear")).toBe(true);
  });
  it("keeps older Fashion stores with no specialty, and never applies elsewhere", () => {
    expect(usesTailoring("Fashion", null)).toBe(true);
    expect(usesTailoring("Restaurant", "Tailoring & Bespoke")).toBe(false);
  });
  it("hides the order page for a clothing shop", () => {
    expect(isStorePageAvailable("/order-request", { businessCategory: "Fashion", businessSubcategory: "Clothing & Apparel" })).toBe(false);
    expect(isStorePageAvailable("/order-request", { businessCategory: "Fashion", businessSubcategory: "Tailoring & Bespoke" })).toBe(true);
  });
});
