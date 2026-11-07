import { describe, it, expect } from "vitest";
import { classifyPagePath } from "../page-usage";

describe("classifyPagePath", () => {
  it("groups seller dashboard pages and hides ids", () => {
    expect(classifyPagePath("/bella-cakes/admin/orders")).toEqual({ path: "/[store]/admin/orders", area: "Seller dashboard" });
    expect(classifyPagePath("/bella-cakes/admin/orders/cm1abcdefghijklmnopqrstu")).toEqual({
      path: "/[store]/admin/orders/[id]",
      area: "Seller dashboard",
    });
    expect(classifyPagePath("/store/bella-cakes/admin")?.path).toBe("/[store]/admin");
  });
  it("groups storefront pages", () => {
    expect(classifyPagePath("/bella-cakes")).toEqual({ path: "/[store]", area: "Storefront" });
    expect(classifyPagePath("/bella-cakes/products/red-velvet")).toEqual({ path: "/[store]/products/[item]", area: "Storefront" });
  });
  it("keeps real platform routes as they are", () => {
    expect(classifyPagePath("/account")).toEqual({ path: "/account", area: "Platform pages" });
    expect(classifyPagePath("/orders/12345")?.path).toBe("/orders/[id]");
    expect(classifyPagePath("/")).toEqual({ path: "/", area: "Platform pages" });
  });
  it("treats custom domains as storefronts and ignores the back office and files", () => {
    expect(classifyPagePath("/products/cake", false)).toEqual({ path: "/[store]/products/[item]", area: "Storefront" });
    expect(classifyPagePath("/supaadmin/stores")).toBeNull();
    expect(classifyPagePath("/api/x")).toBeNull();
    expect(classifyPagePath("/logo.png")).toBeNull();
  });
});
