import { describe, expect, it } from "vitest";
import { categoryHref, categorySegment, cleanCategorySlug, pickUniqueSlug, slugifyCategory, uniqueCategorySlug } from "../category-slug";
import { resolveMenuRows } from "../storefront-menu";

describe("slugifyCategory", () => {
  it("makes readable slugs", () => {
    expect(slugifyCategory("Men's Shoes & Bags")).toBe("mens-shoes-and-bags");
    expect(slugifyCategory("  Phones   & Tablets ")).toBe("phones-and-tablets");
    expect(slugifyCategory("Café Crème")).toBe("cafe-creme");
  });
  it("never returns an empty slug", () => {
    expect(slugifyCategory("!!!")).toBe("category");
    expect(slugifyCategory("日本語")).toBe("category");
  });
  it("caps length without a trailing dash", () => {
    const s = slugifyCategory("a".repeat(59) + " bbbbbbbb");
    expect(s.length).toBeLessThanOrEqual(60);
    expect(s.endsWith("-")).toBe(false);
  });
});

describe("pickUniqueSlug", () => {
  it("keeps the base when free, else counts up", () => {
    expect(pickUniqueSlug("shoes", new Set())).toBe("shoes");
    expect(pickUniqueSlug("shoes", new Set(["shoes"]))).toBe("shoes-2");
    expect(pickUniqueSlug("shoes", new Set(["shoes", "shoes-2", "shoes-3"]))).toBe("shoes-4");
  });
  it("stays within 60 characters when suffixing", () => {
    const base = "a".repeat(60);
    expect(pickUniqueSlug(base, new Set([base])).length).toBeLessThanOrEqual(60);
  });
});

describe("uniqueCategorySlug", () => {
  it("avoids slugs other categories already use", async () => {
    const db = { category: { findMany: async () => [{ slug: "shoes" }, { slug: "shoes-2" }, { slug: null }] } };
    expect(await uniqueCategorySlug(db, "store1", "Shoes")).toBe("shoes-3");
  });
});

describe("cleanCategorySlug", () => {
  it("accepts owner-typed addresses and rejects empties", () => {
    expect(cleanCategorySlug("Summer Sale!")).toBe("summer-sale");
    expect(cleanCategorySlug("   ")).toBeNull();
    expect(cleanCategorySlug("!!!")).toBeNull();
  });
});

describe("category links", () => {
  it("uses the slug, falling back to the id for legacy rows", () => {
    expect(categorySegment({ id: "c1", slug: "shoes" })).toBe("shoes");
    expect(categorySegment({ id: "c1", slug: null })).toBe("c1");
    expect(categoryHref("acme", { id: "c1", slug: "shoes" })).toBe("/store/acme/category/shoes");
  });
  const row = (id: string, label: string, target: string | null, parentId: string | null, sortOrder: number, linkType = "CATEGORY") =>
    ({ id, label, linkType, target, openInNewTab: false, parentId, sortOrder });

  it("menu CATEGORY items resolve to the slug URL", () => {
    const out = resolveMenuRows([row("m1", "Shoes", "c1", null, 0)], "acme", [{ id: "c1", slug: "shoes" }]);
    expect(out[0].href).toBe("/store/acme/category/shoes");
  });
  it("without a category list the id URL is used and nothing is hidden (previews)", () => {
    const out = resolveMenuRows([row("m1", "Shoes", "c1", null, 0)], "acme");
    expect(out[0].href).toBe("/store/acme/category/c1");
  });
});

describe("dead category menu links", () => {
  const row = (id: string, label: string, target: string | null, parentId: string | null, sortOrder: number, linkType = "CATEGORY") =>
    ({ id, label, linkType, target, openInNewTab: false, parentId, sortOrder });

  it("hides a link to a deleted or inactive category", () => {
    const rows = [row("m1", "Shoes", "c1", null, 0), row("m2", "Gone", "c-deleted", null, 1), row("m3", "About", "/about", null, 2, "PAGE")];
    const out = resolveMenuRows(rows, "acme", [{ id: "c1", slug: "shoes" }]);
    expect(out.map((i) => i.label)).toEqual(["Shoes", "About"]);
  });
  it("hides every category link when the store has no active categories", () => {
    const out = resolveMenuRows([row("m1", "Shoes", "c1", null, 0), row("m2", "Contact", "/contact", null, 1, "PAGE")], "acme", []);
    expect(out.map((i) => i.label)).toEqual(["Contact"]);
  });
  it("keeps live dropdown children when their parent category is dead, in place", () => {
    const rows = [
      row("m1", "Home", "/", null, 0, "PAGE"),
      row("m2", "Shop", "c-deleted", null, 1),
      row("m3", "Sale", "/offers", "m2", 2, "PAGE"),
      row("m4", "Dead child", "c-deleted-2", "m2", 3),
      row("m5", "Contact", "/contact", null, 4, "PAGE"),
    ];
    const out = resolveMenuRows(rows, "acme", []);
    expect(out.map((i) => i.label)).toEqual(["Home", "Sale", "Contact"]);
  });
  it("hides only the dead child of a live parent", () => {
    const rows = [row("m1", "Shop", "c1", null, 0), row("m2", "Ok", "c2", "m1", 1), row("m3", "Dead", "c9", "m1", 2)];
    const out = resolveMenuRows(rows, "acme", [{ id: "c1", slug: "shop" }, { id: "c2", slug: "ok" }]);
    expect(out[0].children.map((c) => c.label)).toEqual(["Ok"]);
  });
});
