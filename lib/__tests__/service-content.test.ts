import { describe, expect, it } from "vitest";
import { emptyServiceContent, readServiceContent, serializeServiceContent, normalizeServiceContent } from "@/lib/service-content";

describe("service page content", () => {
  it("round-trips and drops empty entries", () => {
    const json = serializeServiceContent({
      story: " Zanzibar is… ",
      highlights: [{ label: "Duration", value: "5 days" }, { label: "", value: "x" }],
      itinerary: [{ title: "Day 1", text: "Arrive" }, { title: "", text: "" }],
      included: ["Flights", "  "],
      faqs: [{ q: "Visa?", a: "Not needed" }, { q: "Only q", a: "" }],
      article: "travel/zanzibar-guide",
      enquiry: true,
    });
    const c = readServiceContent({ pageBlocks: json });
    expect(c.story).toBe("Zanzibar is…");
    expect(c.highlights).toEqual([{ label: "Duration", value: "5 days" }]);
    expect(c.itinerary).toHaveLength(1);
    expect(c.included).toEqual(["Flights"]);
    expect(c.faqs).toEqual([{ q: "Visa?", a: "Not needed" }]);
    expect(c.article).toBe("travel/zanzibar-guide");
    expect(c.enquiry).toBe(true);
  });

  it("stores nothing when empty, and never invents filler", () => {
    expect(serializeServiceContent(emptyServiceContent())).toBe("");
    expect(readServiceContent(undefined)).toEqual(emptyServiceContent());
    expect(readServiceContent({ pageBlocks: "{not json" })).toEqual(emptyServiceContent());
  });

  it("rejects malformed article links and caps size", () => {
    expect(normalizeServiceContent({ article: "../../etc" }).article).toBe("");
    expect(serializeServiceContent({ story: "a".repeat(100000) }).length).toBeLessThanOrEqual(30000);
  });

  it("keeps enquiry undefined unless set", () => {
    expect(normalizeServiceContent({ story: "x" }).enquiry).toBeUndefined();
  });
});
