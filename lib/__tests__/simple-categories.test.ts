import { describe, expect, it } from "vitest";
import { deleteBlockReason, pluralize, topLevelRows, type CategoryInput } from "../storefront/simple-categories";

const c = (id: string, name: string, sortOrder = 0, parentId: string | null = null, extra: Partial<CategoryInput> = {}): CategoryInput =>
  ({ id, name, type: "PRODUCT", parentId, sortOrder, isActive: true, ...extra });

describe("topLevelRows", () => {
  it("shows only top-level categories, ordered by sortOrder then name", () => {
    const rows = topLevelRows([c("b", "Bread", 1), c("a", "Cakes", 0), c("z", "Apple", 1), c("kid", "Sourdough", 0, "b")], {});
    expect(rows.map((r) => r.name)).toEqual(["Cakes", "Apple", "Bread"]);
  });
  it("counts items and subcategories", () => {
    const rows = topLevelRows([c("b", "Bread"), c("kid", "Sourdough", 0, "b")], { b: 4 });
    expect(rows[0]).toMatchObject({ itemCount: 4, subcategoryCount: 1 });
  });
  it("keeps hidden categories in the list so they can be switched back on", () => {
    expect(topLevelRows([c("a", "Cakes", 0, null, { isActive: false })], {})[0].isActive).toBe(false);
  });
});

describe("deleteBlockReason", () => {
  it("explains what to do first", () => {
    expect(deleteBlockReason({ itemCount: 1, subcategoryCount: 0 })).toMatch(/1 item in it/);
    expect(deleteBlockReason({ itemCount: 3, subcategoryCount: 0 })).toMatch(/3 items/);
    expect(deleteBlockReason({ itemCount: 0, subcategoryCount: 2 })).toMatch(/subcategories/);
    expect(deleteBlockReason({ itemCount: 0, subcategoryCount: 0 })).toBeNull();
  });
});

describe("pluralize", () => {
  it("handles the words the dashboard uses", () => {
    expect(pluralize("Category")).toBe("Categories");
    expect(pluralize("Collection")).toBe("Collections");
  });
});
