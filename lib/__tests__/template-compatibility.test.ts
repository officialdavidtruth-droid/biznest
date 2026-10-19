import { describe, expect, it } from "vitest";
import { TEMPLATE_REGISTRY, PUBLIC_TEMPLATE_REGISTRY, getTemplateDefinition } from "@/lib/template-registry";

describe("template registry consistency", () => {
  it("has unique template names and IDs", () => {
    expect(new Set(TEMPLATE_REGISTRY.map((t) => t.name)).size).toBe(TEMPLATE_REGISTRY.length);
    expect(new Set(TEMPLATE_REGISTRY.map((t) => t.id)).size).toBe(TEMPLATE_REGISTRY.length);
  });
  it("resolves every public template by its canonical name", () => {
    for (const template of PUBLIC_TEMPLATE_REGISTRY) expect(getTemplateDefinition(template.name)?.id).toBe(template.id);
  });
  it("keeps compatibility templates registered", () => {
    expect(getTemplateDefinition("Grandeur — Fine Dining Restaurant")?.renderer).toBe("grandeur");
    expect(getTemplateDefinition("TasteHouse — Food Delivery")?.renderer).toBe("tastehouse");
    expect(getTemplateDefinition("Example — Modern Electronics Store")?.renderer).toBe("example");
  });
});
