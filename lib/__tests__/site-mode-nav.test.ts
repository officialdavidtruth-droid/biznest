import { describe, expect, it } from "vitest";
import { buildNavGroups, findNavItemForPath } from "../constants/dashboard-nav";
import { isSiteMode, normalizeSiteMode } from "../site-mode";

const business = { sellsProducts: true, offersServices: false, category: "Retail" };
const hrefs = (siteMode?: "SIMPLE" | "ADVANCED") =>
  buildNavGroups({ ...business, siteMode }).flatMap((g) => g.items.flatMap((i) => [i.href, ...(i.children ?? []).map((c) => c.href)]));

describe("site mode", () => {
  it("only accepts the two known modes from a request", () => {
    expect(isSiteMode("SIMPLE")).toBe(true);
    expect(isSiteMode("ADVANCED")).toBe(true);
    expect(isSiteMode("simple")).toBe(false);
    expect(isSiteMode(undefined)).toBe(false);
  });
  it("falls back to Simple for anything unexpected in storage", () => {
    expect(normalizeSiteMode(null)).toBe("SIMPLE");
    expect(normalizeSiteMode("weird")).toBe("SIMPLE");
    expect(normalizeSiteMode("ADVANCED")).toBe("ADVANCED");
  });
});

describe("dashboard nav by site mode", () => {
  it("Simple shows My Website and hides the technical editors", () => {
    const simple = hrefs("SIMPLE");
    expect(simple).toContain("/website");
    for (const h of ["/templates", "/customize", "/menus", "/menu-sections"]) expect(simple).not.toContain(h);
  });
  it("Advanced shows My Website plus every editor", () => {
    const adv = hrefs("ADVANCED");
    for (const h of ["/website", "/templates", "/customize", "/menus", "/menu-sections"]) expect(adv).toContain(h);
  });
  it("Simple keeps categories under the catalog", () => {
    expect(hrefs("SIMPLE")).toContain("/categories");
  });
  it("with no mode given it lists everything, so permission lookups are unchanged", () => {
    expect(hrefs(undefined)).toEqual(hrefs("ADVANCED"));
    expect(findNavItemForPath(business, "/menus")?.permission).toBe("settings");
    expect(findNavItemForPath(business, "/website")?.permission).toBe("settings");
  });
});
