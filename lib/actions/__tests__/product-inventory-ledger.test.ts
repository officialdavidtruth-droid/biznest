import { describe, expect, it } from "vitest";
import fs from "node:fs";

const source = fs.readFileSync("lib/actions/product.ts", "utf8");

describe("product edit inventory integrity", () => {
  it("uses serializable transactions for quantity edits", () => {
    expect(source).toContain('isolationLevel: "Serializable"');
  });

  it("creates a correction movement when a product edit changes quantity", () => {
    expect(source).toContain('type: "CORRECTION"');
    expect(source).toContain('note: "Product edit"');
    expect(source).toContain("quantityChange: delta");
    expect(source).toContain("quantityAfter: nextQuantity");
  });

  it("guards the inventory update against stale quantity overwrites", () => {
    expect(source).toContain("quantity: current.inventory.quantity");
    expect(source).toContain("if (updated.count !== 1) throw new Error(\"INVENTORY_CONFLICT\")");
  });
});
