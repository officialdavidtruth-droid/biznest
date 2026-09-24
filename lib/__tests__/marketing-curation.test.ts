import { describe, expect, it } from "vitest";
import { curateMarketingTemplates, type MarketingBrand, type MarketingItem } from "@/lib/email/marketing-templates";

const brand = (businessType: string): MarketingBrand => ({
  name: "Example Business", storeId: "store-1", slug: "example", primary: "#0a6b3a", secondary: "#063b25", accent: "#0a6b3a", background: "#f3f4f6", text: "#111827", fontFamily: "Arial", businessType, sellsProducts: false, offersServices: true,
});

describe("rule-based marketing template curation", () => {
  it("puts hospitality designs first for hotels", () => {
    const result = curateMarketingTemplates(brand("Hotel"), []);
    expect(result[0].id).toBe("ref_hotel");
  });

  it("puts restaurant design first for restaurants", () => {
    const result = curateMarketingTemplates(brand("Restaurant"), []);
    expect(result[0].id).toBe("ref_dark_menu");
    expect(result).toHaveLength(12);
  });

  it("uses catalog shape when business type is generic", () => {
    const items: MarketingItem[] = [{ kind: "product", name: "Product One", imageUrl: "https://example.com/p.jpg" }];
    const result = curateMarketingTemplates(brand("Business"), items);
    expect(result[0].id).toBe("ref_offer");
  });

  it("always returns the generated design set without an AI dependency", () => {
    const result = curateMarketingTemplates(brand("Unknown"), []);
    expect(result).toHaveLength(12);
    expect(result.map(x => x.id).sort()).toEqual([
      "ref_confirmation", "ref_dark_menu", "ref_editorial", "ref_food_catalog",
      "ref_hotel", "ref_journey", "ref_offer", "ref_pricing", "ref_product_launch",
      "ref_restaurant", "ref_catalog", "ref_thankyou",
    ].sort());
  });
});
