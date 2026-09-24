import { describe, expect, it } from "vitest";
import { curateMarketingTemplates, type MarketingBrand, type MarketingItem } from "@/lib/email/marketing-templates";

const brand = (businessType: string): MarketingBrand => ({
  name: "Example Business", storeId: "store-1", slug: "example", primary: "#0a6b3a", secondary: "#063b25", accent: "#0a6b3a", background: "#f3f4f6", text: "#111827", fontFamily: "Arial", businessType, sellsProducts: false, offersServices: true,
});

describe("rule-based marketing template curation", () => {
  it("puts hospitality designs first for hotels", () => {
    const result = curateMarketingTemplates(brand("Hotel"), []);
    expect(result.map(x => x.id)).toEqual(["luxury", "welcome", "premium_offer", "editorial", "launch", "restaurant"]);
  });

  it("puts restaurant design first for restaurants", () => {
    const result = curateMarketingTemplates(brand("Restaurant"), []);
    expect(result[0].id).toBe("restaurant");
    expect(result).toHaveLength(6);
  });

  it("uses catalog shape when business type is generic", () => {
    const items: MarketingItem[] = [{ kind: "product", name: "Product One", imageUrl: "https://example.com/p.jpg" }];
    const result = curateMarketingTemplates(brand("Business"), items);
    expect(result[0].id).toBe("premium_offer");
  });

  it("always returns the six curated designs without an AI dependency", () => {
    const result = curateMarketingTemplates(brand("Unknown"), []);
    expect(result.map(x => x.id).sort()).toEqual(["editorial", "launch", "luxury", "premium_offer", "restaurant", "welcome"].sort());
  });
});
