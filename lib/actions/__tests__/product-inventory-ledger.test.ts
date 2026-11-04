import { describe, expect, it } from "vitest";
import fs from "node:fs";

const source = fs.readFileSync("lib/actions/product.ts", "utf8");

describe("product edit inventory integrity", () => {
  it("uses serializable transactions for quantity edits", () => {
    expect(source).toContain('isolationLevel: "Serializable"');
  });

  it("creates a correction movement when a product edit changes quantity", () => {
    const stock = fs.readFileSync("lib/catalog/stock.ts", "utf8");
    expect(stock).toContain('type: "CORRECTION"');
    expect(stock).toContain("quantityChange: delta");
    expect(source).toContain("correctInventoryQuantityTx(tx");
    expect(source).toContain('note: "Product edit"');
  });

  it("guards the inventory update against stale quantity overwrites", () => {
    const stock = fs.readFileSync("lib/catalog/stock.ts", "utf8");
    expect(source).toMatch(/guard: \{ quantity: /);
    expect(stock).toContain("...args.guard");
    expect(stock).toContain("if (updated.count !== 1) throw new Error(\"INVENTORY_CONFLICT\")");
  });
});
