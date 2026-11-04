import { describe, expect, it } from "vitest";
import { applySectionHeadings, getSectionHeadings, normalizeHeadings } from "@/lib/storefront/section-headings";

describe("owner section headings", () => {
  it("keeps only editable sections and trims text", () => {
    expect(normalizeHeadings({ categories: { heading: "  Shop by room " }, hero: { heading: "x" }, about: { heading: "" } })).toEqual({ categories: { heading: "Shop by room" } });
  });
  it("reads from sectionOverrides and tolerates junk", () => {
    expect(getSectionHeadings(null)).toEqual({});
    expect(getSectionHeadings({ sectionHeadings: { catalog: { heading: "Our work" } } })).toEqual({ catalog: { heading: "Our work" } });
  });
  it("overrides only the matching section's heading", () => {
    const out = applySectionHeadings([{ type: "hero", settings: { heading: "H" } }, { type: "catalog", settings: { heading: "Featured", body: "b" } }], { catalog: { heading: "Our work" } });
    expect(out[0].settings?.heading).toBe("H");
    expect(out[1].settings).toEqual({ heading: "Our work", body: "b" });
  });
});
