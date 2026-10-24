import { describe, expect, it, vi } from "vitest";

// template-themes -> example-content imports the Prisma client; the logic under test is pure.
vi.mock("@/lib/prisma", () => ({ prisma: {} }));

import { CANONICAL_BUSINESS_TYPES } from "@/lib/business-identity";
import { MENU_PAGE_OPTIONS } from "@/lib/storefront-menu";
import { filterAvailablePages, getStoreKind, isGrandeurStore, isStorePageAvailable } from "@/lib/store-pages";

const VERTICAL_ONLY = ["/gallery", "/events", "/reservations", "/rooms", "/amenities", "/dining", "/experiences", "/facilities", "/book"];
const UNIVERSAL = ["/", "/about", "/contact", "/catalog", "/cart", "/orders", "/account", "/support"];
const id = (businessCategory: string) => ({ businessCategory, storeBusinessType: businessCategory, templateName: null });

describe("store page availability (regression: restaurant skin leaking onto other stores)", () => {
  const others = CANONICAL_BUSINESS_TYPES.filter((t) => t !== "Restaurant" && t !== "Hotel & Lodging");

  it.each(others)("%s store is never treated as restaurant or hotel and has no vertical-only pages", (type) => {
    expect(isGrandeurStore(id(type))).toBe(false);
    expect(getStoreKind(id(type))).toBe("other");
    for (const p of VERTICAL_ONLY) expect(isStorePageAvailable(p, id(type)), `${type} ${p}`).toBe(false);
  });

  it("universal pages are available to every store type", () => {
    for (const t of CANONICAL_BUSINESS_TYPES) for (const p of UNIVERSAL) expect(isStorePageAvailable(p, id(t)), `${t} ${p}`).toBe(true);
  });

  it("restaurants get gallery, events and reservations but not hotel pages", () => {
    const r = id("Restaurant");
    expect(getStoreKind(r)).toBe("restaurant");
    for (const p of ["/gallery", "/events", "/reservations"]) expect(isStorePageAvailable(p, r)).toBe(true);
    for (const p of ["/rooms", "/amenities", "/dining", "/book"]) expect(isStorePageAvailable(p, r)).toBe(false);
  });

  it("hotels get hotel pages plus gallery and events, but not restaurant reservations", () => {
    const h = id("Hotel & Lodging");
    expect(getStoreKind(h)).toBe("hotel");
    for (const p of ["/rooms", "/amenities", "/dining", "/book", "/gallery", "/events"]) expect(isStorePageAvailable(p, h)).toBe(true);
    expect(isStorePageAvailable("/reservations", h)).toBe(false);
  });

  it("menu picker for an electronics store omits every vertical-only page", () => {
    const paths = filterAvailablePages(MENU_PAGE_OPTIONS, id("Electronics")).map((o) => o.path);
    for (const p of VERTICAL_ONLY) expect(paths).not.toContain(p);
    expect(paths).toContain("/about");
  });
});
