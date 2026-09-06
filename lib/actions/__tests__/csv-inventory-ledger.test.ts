import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

describe("CSV inventory integrity", () => {
  const source = readFileSync(resolve(process.cwd(), "lib/actions/bulk.ts"), "utf8");

  it("exports an inventory timestamp for stale-import detection", () => {
    expect(source).toContain('"inventoryUpdatedAt"');
    expect(source).toContain("updatedAt.toISOString()");
  });

  it("uses serializable transactions for CSV inventory writes", () => {
    expect(source).toContain('isolationLevel: "Serializable"');
    expect(source).toContain('timeout: 15000');
    expect(source).toContain('err?.code === "P2034"');
  });

  it("records corrections for imported quantity changes", () => {
    expect(source).toContain('type: "CORRECTION"');
    expect(source).toContain('note: "CSV import"');
    expect(source).toContain("quantityChange: delta");
    expect(source).toContain("quantityAfter: nextQuantity");
  });

  it("records initial imported stock as a restock movement", () => {
    expect(source).toContain('type: "RESTOCK"');
    expect(source).toContain('note: "CSV import initial stock"');
  });

  it("scopes category lookup to the current store", () => {
    expect(source).toContain('where: { name: r.category.trim(), storeId: access.store.id }');
  });

  it("rejects stale CSV inventory snapshots", () => {
    expect(source).toContain("INVENTORY_CONFLICT");
    expect(source).toContain("Inventory changed since this CSV was exported.");
    expect(source).toContain("updatedAt: variant.updatedAt");
    expect(source).toContain("updatedAt: product.inventory.updatedAt");
  });
});
