import { describe, expect, it } from "vitest";
import { isTemplateCompatible } from "@/lib/template-compatibility";
import { TEMPLATE_NAME } from "@/lib/template-themes";

describe("template compatibility", () => {
  it("only exposes the approved Grandeur restaurant template", () => {
    expect(isTemplateCompatible({ name: TEMPLATE_NAME, category: "Restaurant" }, "Restaurant", { sellsProducts: true, offersServices: true })).toBe(true);
    expect(isTemplateCompatible({ name: "Grand Vere — Hotel & Resort", category: "Hotel & Lodging" }, "Hotel & Lodging", { offersServices: true })).toBe(false);
    expect(isTemplateCompatible({ name: "Fresh & Co.", category: "Professional Services" }, "Cleaning", { offersServices: true })).toBe(false);
  });
});
