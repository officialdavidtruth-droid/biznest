import { describe, expect, it } from "vitest";
import { primaryCta } from "@/components/storefront/universal-section-pages";

const theme = { accent: "#1473ea" } as any;

describe("universal storefront primary CTA", () => {
  it("routes hotels to rooms", () => {
    expect(primaryCta({ business: { category: "Hotel & Lodging" }, sellsProducts: false, offersServices: true }, "demo", theme))
      .toEqual({ label: "Book a Stay", href: "/store/demo/hotel/rooms" });
  });

  it("routes restaurants to the catalog/menu", () => {
    expect(primaryCta({ business: { category: "Restaurant" }, sellsProducts: false, offersServices: true }, "demo", theme))
      .toEqual({ label: "View Menu", href: "/store/demo/catalog" });
  });

  it("routes product businesses to the catalog", () => {
    expect(primaryCta({ business: { category: "Electronics" }, sellsProducts: true, offersServices: false }, "demo", theme))
      .toEqual({ label: "Shop Now", href: "/store/demo/catalog" });
  });

  it("routes service businesses to project enquiry", () => {
    expect(primaryCta({ business: { category: "Professional Services" }, sellsProducts: false, offersServices: true }, "demo", theme))
      .toEqual({ label: "Get a Quote", href: "/store/demo/start-project" });
  });
});
