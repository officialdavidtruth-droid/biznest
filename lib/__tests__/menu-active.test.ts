import { describe, expect, it } from "vitest";
import { isMenuItemActive, storeRelativePath } from "../storefront-menu";

const link = (href: string, external = false, children: { href: string; external: boolean }[] = []) => ({ href, external, children });

describe("storeRelativePath", () => {
  it("gives the same path for internal, root and custom-domain URLs", () => {
    expect(storeRelativePath("/store/acme/about", "acme")).toBe("/about");
    expect(storeRelativePath("/acme/about", "acme")).toBe("/about");
    expect(storeRelativePath("/about", "acme")).toBe("/about");
    expect(storeRelativePath("/store/acme", "acme")).toBe("/");
    expect(storeRelativePath("/acme/", "acme")).toBe("/");
  });
  it("ignores query, hash, case and trailing slash", () => {
    expect(storeRelativePath("/store/Acme/About/?x=1#top", "acme")).toBe("/about");
  });
  it("does not strip a prefix that only looks similar", () => {
    expect(storeRelativePath("/store/acme-two/about", "acme")).toBe("/store/acme-two/about");
  });
});

describe("isMenuItemActive", () => {
  it("lights the exact page, however it was reached", () => {
    expect(isMenuItemActive(link("/store/acme/about"), "/acme/about", "acme")).toBe(true);
    expect(isMenuItemActive(link("/store/acme/about"), "/store/acme/contact", "acme")).toBe(false);
  });
  it("two links with the same label no longer both light up (they differ by address)", () => {
    const a = link("/store/acme/category/shoes");
    const b = link("/store/acme/category/bags");
    const here = "/store/acme/category/shoes";
    expect([isMenuItemActive(a, here, "acme"), isMenuItemActive(b, here, "acme")]).toEqual([true, false]);
  });
  it("Home only matches the home page", () => {
    expect(isMenuItemActive(link("/store/acme"), "/store/acme", "acme")).toBe(true);
    expect(isMenuItemActive(link("/store/acme"), "/store/acme/about", "acme")).toBe(false);
  });
  it("a section link stays lit on pages inside it, but not on lookalikes", () => {
    expect(isMenuItemActive(link("/store/acme/blog"), "/store/acme/blog/my-post", "acme")).toBe(true);
    expect(isMenuItemActive(link("/store/acme/blog"), "/store/acme/blogger", "acme")).toBe(false);
  });
  it("a dropdown parent lights when a child page is open", () => {
    const parent = link("/store/acme/catalog", false, [{ href: "/store/acme/category/shoes", external: false }]);
    expect(isMenuItemActive(parent, "/store/acme/category/shoes", "acme")).toBe(true);
  });
  it("external links, anchors, mailto and tel never light", () => {
    expect(isMenuItemActive(link("https://x.com/about", true), "/store/acme/about", "acme")).toBe(false);
    expect(isMenuItemActive(link("#catalog"), "/store/acme", "acme")).toBe(false);
    expect(isMenuItemActive(link("mailto:a@b.com", true), "/store/acme", "acme")).toBe(false);
  });
});
