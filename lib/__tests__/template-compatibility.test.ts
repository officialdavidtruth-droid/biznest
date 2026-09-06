import { describe, expect, it } from "vitest";
import { isTemplateCompatible } from "@/lib/template-compatibility";

const signature = (name: string, mode: string, category = "Professional Services") => ({
  name,
  category,
  config: { signatureMode: mode },
});

describe("template compatibility", () => {
  it("does not allow a hotel signature template for another service business", () => {
    expect(isTemplateCompatible(signature("Grand Vere — Hotel & Resort", "grand-vere", "Hotel & Lodging"), "Cleaning", { offersServices: true })).toBe(false);
  });

  it("allows a hotel signature template for a hotel", () => {
    expect(isTemplateCompatible(signature("Grand Vere — Hotel & Resort", "grand-vere", "Hotel & Lodging"), "Hotel & Lodging", { offersServices: true })).toBe(true);
  });

  it("does not allow the Beauty commerce template when Beauty is service-only", () => {
    expect(isTemplateCompatible(signature("Bloom — Beauty Boutique", "bloom", "Beauty"), "Beauty", { sellsProducts: false, offersServices: true })).toBe(false);
  });

  it("allows the Beauty commerce template for a hybrid Beauty business", () => {
    expect(isTemplateCompatible(signature("Bloom — Beauty Boutique", "bloom", "Beauty"), "Beauty", { sellsProducts: true, offersServices: true })).toBe(true);
  });

  it("allows generic service templates across service businesses", () => {
    expect(isTemplateCompatible({ name: "Fresh & Co.", category: "Professional Services" }, "Cleaning", { offersServices: true })).toBe(true);
  });
});
