import { describe, it, expect } from "vitest";
import { blocksToPlainText, hasPageContent, newBlock, sanitizeBlocks } from "@/lib/storefront/page-blocks";
import { collectionOrderBy, orderByIds } from "@/lib/storefront/page-block-catalog";

describe("products block", () => {
  it("keeps valid unique ids in order and caps at 12", () => {
    const ids = Array.from({ length: 20 }, (_, i) => `p${i}`);
    const [b] = sanitizeBlocks([{ type: "products", title: " Picks ", productIds: ["a", "b", "a", "bad id!", 5, ...ids] }]);
    expect(b.type).toBe("products");
    const kept = (b as { productIds: string[] }).productIds;
    expect(kept.slice(0, 2)).toEqual(["a", "b"]);
    expect(kept).toHaveLength(12);
    expect(new Set(kept).size).toBe(12);
    expect((b as { title: string }).title).toBe("Picks");
  });

  it("drops a products block with nothing valid chosen", () => {
    expect(sanitizeBlocks([{ type: "products", productIds: [] }, { type: "products", productIds: ["x y", "../z"] }, { type: "products" }])).toEqual([]);
  });

  it("a new products block is empty, so it is not saved until products are chosen", () => {
    expect(sanitizeBlocks([newBlock("products")])).toEqual([]);
  });
});

describe("collection block", () => {
  it("falls back to safe defaults for bad values", () => {
    const [b] = sanitizeBlocks([{ type: "collection", categoryId: "../x", limit: 99, sort: "random" }]);
    expect(b).toMatchObject({ type: "collection", categoryId: "", limit: 4, sort: "newest" });
  });

  it("keeps a valid category, limit and sort", () => {
    const [b] = sanitizeBlocks([{ type: "collection", categoryId: "cmabc123", limit: 12, sort: "price-desc" }]);
    expect(b).toMatchObject({ categoryId: "cmabc123", limit: 12, sort: "price-desc" });
  });

  it("allows at most 6 product blocks per page", () => {
    const many = Array.from({ length: 10 }, (_, i) => (i % 2 ? { type: "collection" } : { type: "products", productIds: ["a"] }));
    expect(sanitizeBlocks(many)).toHaveLength(6);
  });
});

describe("catalogue blocks and page text", () => {
  it("count as page content and put only the heading into the plain text", () => {
    const blocks = sanitizeBlocks([{ type: "collection", title: "New arrivals" }]);
    expect(hasPageContent({ body: "", blocks })).toBe(true);
    expect(blocksToPlainText(blocks)).toBe("New arrivals");
  });
});

describe("resolver helpers", () => {
  it("keeps the owner's order and skips products that are gone", () => {
    const rows = [{ id: "a" }, { id: "b" }, { id: "c" }];
    expect(orderByIds(rows, ["c", "gone", "a"]).map((r) => r.id)).toEqual(["c", "a"]);
  });

  it("sorts by the chosen order", () => {
    expect(collectionOrderBy("price-asc")[0]).toEqual({ price: "asc" });
    expect(collectionOrderBy("price-desc")[0]).toEqual({ price: "desc" });
    expect(collectionOrderBy("newest")).toEqual([{ createdAt: "desc" }]);
  });
});
