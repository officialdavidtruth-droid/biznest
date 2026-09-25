import { describe, expect, it } from "vitest";
import { curateMarketingTemplates, type MarketingBrand, type MarketingItem } from "@/lib/email/marketing-templates";

const brand = (businessType: string): MarketingBrand => ({
  name: "Example Business", storeId: "store-1", slug: "example", primary: "#0a6b3a", secondary: "#063b25", accent: "#c58b35", background: "#f3f4f6", text: "#111827", fontFamily: "Arial", businessType, sellsProducts: false, offersServices: true,
});

const generatedIds = [
  "ref_dark_menu", "ref_food_catalog", "ref_restaurant", "ref_offer",
  "ref_editorial", "ref_thankyou", "ref_confirmation", "ref_pricing",
  "ref_hotel", "ref_journey", "ref_catalog", "ref_product_launch",
];

describe("generated marketing template curation", () => {
  it("returns all generated designs for every business", () => {
    const result = curateMarketingTemplates(brand("Business"), []);
    expect(result).toHaveLength(12);
    expect(result.map(x => x.id).sort()).toEqual([...generatedIds].sort());
  });

  it("puts hospitality designs first for hotels", () => {
    const result = curateMarketingTemplates(brand("Hotel"), []);
    expect(result[0].id).toBe("ref_hotel");
    expect(result.some(x => x.id === "ref_journey")).toBe(true);
  });

  it("puts menu designs first for restaurants", () => {
    const result = curateMarketingTemplates(brand("Restaurant"), []);
    expect(result[0].id).toBe("ref_dark_menu");
    expect(result[1].id).toBe("ref_food_catalog");
  });

  it("uses product launch for an ecommerce catalog", () => {
    const items: MarketingItem[] = [{ kind: "product", name: "Product One", imageUrl: "https://example.com/p.jpg" }];
    const result = curateMarketingTemplates(brand("E-commerce"), items);
    expect(result[0].id).toBe("ref_product_launch");
  });
});
