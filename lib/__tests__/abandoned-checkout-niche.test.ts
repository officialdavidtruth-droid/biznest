import { describe, expect, it } from "vitest";
import { supportsAbandonedCheckout } from "@/lib/business-identity";

describe("supportsAbandonedCheckout", () => {
  it("hides it for hotels under any spelling, even if they sell products", () => {
    for (const c of ["Hotel & Lodging", "hotel", "Hotels", "lodging"]) {
      expect(supportsAbandonedCheckout(c, { sellsProducts: true })).toBe(false);
    }
  });
  it("hides it for service-only businesses", () => {
    expect(supportsAbandonedCheckout("Salon", { sellsProducts: false })).toBe(false);
  });
  it("keeps it for cart-checkout businesses", () => {
    expect(supportsAbandonedCheckout("Fashion", { sellsProducts: true })).toBe(true);
    expect(supportsAbandonedCheckout("Restaurant", { sellsProducts: true })).toBe(true);
    expect(supportsAbandonedCheckout("Retail")).toBe(true);
  });
});
