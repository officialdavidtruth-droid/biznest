import { describe, expect, it } from "vitest";
import { nicheFor, resolveServicesListing, servicesNavLink } from "@/lib/storefront-niche";

const store = (category: string, businessSubcategory?: string) => ({ business: { category, businessSubcategory } });
const GENERIC_BADGES = ["Quality Service", "Fast Response", "Professional Results", "Published policies"];

describe("niche profile: layout and copy per business type", () => {
  const nonCorporate: Array<[string, string]> = [
    ["Salon", "editorial"], ["Beauty", "editorial"], ["Hotel & Lodging", "editorial"], ["Restaurant", "editorial"],
    ["Cleaning", "editorial"], ["Event Planning", "editorial"], ["Photography", "editorial"], ["Health & Fitness", "editorial"],
    ["Automotive", "built"], ["Logistics", "built"], ["Construction", "built"],
  ];
  it.each(nonCorporate)("%s does not fall back to the corporate layout", (category, archetype) => {
    expect(nicheFor(store(category)).archetype).toBe(archetype);
  });

  it("keeps trust-led corporate layout only where it fits (health, legal, unknown)", () => {
    expect(nicheFor(store("Health")).archetype).toBe("corporate");
    expect(nicheFor(store("Professional Services", "Legal Services")).archetype).toBe("corporate");
    expect(nicheFor(store("Other")).archetype).toBe("corporate");
  });

  it.each(["Salon", "Hotel & Lodging", "Restaurant", "Health", "Cleaning", "Automotive", "Event Planning", "Logistics"])(
    "%s gets its own badges, not the generic ones", (category) => {
      const n = nicheFor(store(category));
      for (const b of n.trust) expect(GENERIC_BADGES).not.toContain(b.label);
      expect(n.band.eyebrow).not.toBe("NEED SOMETHING CUSTOM?");
    });

  it("hotel and salon do not get the 'Start a Project' band", () => {
    expect(nicheFor(store("Hotel & Lodging")).band.cta).toBeUndefined();
    expect(nicheFor(store("Salon")).band.cta).toBeUndefined();
    expect(nicheFor(store("Hotel & Lodging")).servicesLabel).toBe("Rooms");
  });

  it("falls back to the legacy store.businessType when business.category is empty", () => {
    expect(nicheFor({ business: { category: "" }, businessType: "Salon" }).key).toBe("salon");
  });

  it("preserves professional-services sub-niche layouts and copy", () => {
    expect(nicheFor(store("Professional Services", "Web & Software Development")).archetype).toBe("technical");
    expect(nicheFor(store("Professional Services", "Architecture & Interior Design")).trust.map((b) => b.label)).toEqual(["Licensed Crews", "On-Schedule Delivery", "Built to Spec"]);
    expect(nicheFor(store("Professional Services", "Legal Services")).band.eyebrow).toBe("NEED SOMETHING CUSTOM?");
    expect(nicheFor(store("Other", "Graphic Design & Printing")).archetype).toBe("editorial");
  });

  it("every niche supplies 3 badges and 4 FAQ items", () => {
    for (const c of ["Fashion", "Salon", "Hotel & Lodging", "Church", "Logistics", "Other", "Agency"]) {
      const n = nicheFor(store(c));
      expect(n.trust).toHaveLength(3);
      expect(n.faq).toHaveLength(4);
    }
  });
});

describe("/services never shows products under 'Services'", () => {
  const products = [{ id: "p1" }, { id: "p2" }];
  const services = [{ id: "s1" }];

  it("lists services when they exist, never mixing in products", () => {
    expect(resolveServicesListing(nicheFor(store("Fashion")), services, products)).toEqual({ mode: "list", items: services });
  });

  it("sends a product-only commerce store to its catalog", () => {
    expect(resolveServicesListing(nicheFor(store("Fashion")), [], products)).toEqual({ mode: "redirect-to-catalog" });
    expect(resolveServicesListing(nicheFor(store("Beauty")), [], products)).toEqual({ mode: "redirect-to-catalog" });
  });

  it("still lists products for a restaurant menu", () => {
    expect(resolveServicesListing(nicheFor(store("Restaurant")), [], products)).toEqual({ mode: "list", items: products });
  });

  it("shows an empty state, not a redirect, when there is nothing at all", () => {
    expect(resolveServicesListing(nicheFor(store("Salon")), [], [])).toEqual({ mode: "empty" });
  });

  it("nav shows Shop -> catalog for product-only stores, niche label otherwise", () => {
    expect(servicesNavLink(nicheFor(store("Fashion")), false, true)).toEqual(["Shop", "catalog"]);
    expect(servicesNavLink(nicheFor(store("Fashion")), true, true)).toEqual(["Services", "services"]);
    expect(servicesNavLink(nicheFor(store("Hotel & Lodging")), true, false)).toEqual(["Rooms", "services"]);
    expect(servicesNavLink(nicheFor(store("Restaurant")), false, true)).toEqual(["Menu", "services"]);
    expect(servicesNavLink(nicheFor(store("Salon")), false, false)).toEqual(["Services", "services"]);
  });
});

describe("FAQ copy is not restaurant-flavored for other niches", () => {
  const categories = ["Fashion", "Electronics", "Retail", "Food & Groceries", "Home & Furniture", "Agriculture", "Real Estate", "Beauty", "Salon",
    "Hotel & Lodging", "Photography", "Professional Services", "Agency", "Cleaning", "Construction", "Health", "Health & Fitness", "Automotive",
    "Software Development", "Event Planning", "Logistics", "Church", "Other"];
  it.each(categories)("%s FAQ never mentions a restaurant", (category) => {
    for (const q of nicheFor(store(category)).faq) expect(q).not.toMatch(/restaurant|menu|table/i);
  });
  it("restaurants keep their own FAQ", () => {
    expect(nicheFor(store("Restaurant")).faq.join(" ")).toMatch(/restaurant/i);
  });
});
