import { describe, expect, it } from "vitest";
import { isStorePageAvailable } from "@/lib/store-pages";
import { MENU_PAGE_OPTIONS } from "@/lib/storefront-menu";

describe("made-to-measure order page", () => {
  it("is a menu choice, offered only to fashion businesses", () => {
    expect(MENU_PAGE_OPTIONS.some((o) => o.path === "/order-request")).toBe(true);
    expect(isStorePageAvailable("/order-request", { businessCategory: "Fashion" })).toBe(true);
    expect(isStorePageAvailable("/order-request", { businessCategory: "Restaurant" })).toBe(false);
    expect(isStorePageAvailable("/order-request", { businessCategory: "Travel & Tourism" })).toBe(false);
  });
});
