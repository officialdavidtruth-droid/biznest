import { describe, expect, it } from "vitest";
import { getBusinessExperience, resolveBusinessMode } from "@/lib/business-experience";
import { getTemplateBusinessType, getTemplateMode, isTemplateCompatible } from "@/lib/template-compatibility";

describe("business experience", () => {
  it("uses onboarding choices as the source of the operating model", () => {
    expect(resolveBusinessMode("Fashion", { sellsProducts: false, offersServices: true })).toBe("service");
    expect(resolveBusinessMode("Salon", { sellsProducts: true, offersServices: false })).toBe("commerce");
    expect(resolveBusinessMode("Automotive", { sellsProducts: true, offersServices: true })).toBe("hybrid");
  });

  it("gives service businesses a service-first website experience", () => {
    const experience = getBusinessExperience("Salon", { sellsProducts: false, offersServices: true });
    expect(experience.mode).toBe("service");
    expect(experience.primaryAction).toBe("Book an appointment");
    expect(experience.pageSlugs.map((p) => p.slug)).toContain("services");
    expect(experience.pageSlugs.map((p) => p.slug)).not.toContain("products");
  });

  it("maps signature templates to their actual business model", () => {
    const muse = { name: "Muse — Salon & Beauty", category: "muse", config: { signatureMode: "muse" } };
    expect(getTemplateMode(muse)).toBe("service");
    expect(getTemplateBusinessType(muse)).toBe("Salon");
    expect(isTemplateCompatible(muse, "Beauty", { sellsProducts: false, offersServices: true })).toBe(true);
  });

  it("does not allow a service-only business to select a commerce template", () => {
    const retail = { name: "Electra — Smart Commerce", category: "electra", config: { signatureMode: "electra" } };
    expect(isTemplateCompatible(retail, "Salon", { sellsProducts: false, offersServices: true })).toBe(false);
  });
});
