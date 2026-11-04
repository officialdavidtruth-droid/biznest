import { describe, expect, it } from "vitest";
import { TEMPLATE_REGISTRY } from "@/lib/template-registry";
import { templateDisplayName } from "@/lib/template-display-name";

describe("template display names", () => {
  it("are unique across the catalog", () => {
    const shown = TEMPLATE_REGISTRY.map((t) => templateDisplayName(t.name));
    expect(new Set(shown).size).toBe(shown.length);
  });
  it("carry no business-type words for Builder templates", () => {
    const niche = /restaurant|salon|beauty|clinic|hotel|fashion|photography|cleaning|construction|logistics|recruitment|grocery|furniture|electronics|travel|real estate|fitness|events|agency|sneaker|food|fine dining/i;
    for (const t of TEMPLATE_REGISTRY.filter((x) => x.home === "builder")) expect(templateDisplayName(t.name), t.name).not.toMatch(niche);
  });
  it("keeps the stored name untouched", () => {
    expect(templateDisplayName("Unknown Name")).toBe("Unknown Name");
  });
});
