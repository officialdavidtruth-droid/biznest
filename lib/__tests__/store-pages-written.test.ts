import { describe, it, expect, vi } from "vitest";

// The store-pages import chain reaches the Prisma client; the logic under test is pure.
vi.mock("@/lib/prisma", () => ({ prisma: {} }));

import { isStorePageAvailable } from "@/lib/store-pages";

const shop = { businessCategory: "Electronics", storeBusinessType: "Electronics", templateName: null };
const hotel = { businessCategory: "Hotel & Lodging", storeBusinessType: "Hotel & Lodging", templateName: null };
const none = new Set<string>();

describe("menu availability of owner-written pages", () => {
  it("is unchanged when no written set is passed", () => {
    expect(isStorePageAvailable("/blog", shop)).toBe(true);
    expect(isStorePageAvailable("/gallery", shop)).toBe(false);
  });

  it("offers Blog only once the owner has written it", () => {
    expect(isStorePageAvailable("/blog", shop, none)).toBe(false);
    expect(isStorePageAvailable("/blog", shop, new Set(["blog"]))).toBe(true);
  });

  it("offers Gallery to a shop only once written, and always to a hotel", () => {
    expect(isStorePageAvailable("/gallery", shop, none)).toBe(false);
    expect(isStorePageAvailable("/gallery", shop, new Set(["gallery"]))).toBe(true);
    expect(isStorePageAvailable("/gallery", hotel, none)).toBe(true);
  });

  it("leaves every other page alone", () => {
    expect(isStorePageAvailable("/about", shop, none)).toBe(true);
    expect(isStorePageAvailable("/rooms", shop, new Set(["rooms"]))).toBe(false);
  });
});
