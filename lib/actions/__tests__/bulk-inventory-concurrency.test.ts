import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

describe("bulk product inventory concurrency hardening", () => {
  const source = readFileSync(resolve(process.cwd(), "lib/actions/bulk.ts"), "utf8");

  it("uses a serializable transaction for bulk edits", () => {
    expect(source).toContain('isolationLevel: "Serializable"');
    expect(source).toContain('timeout: 15000');
    expect(source).toContain('err?.code === "P2034"');
  });

  it("detects stale absolute quantity edits instead of overwriting newer stock", () => {
    expect(source).toContain("currentInventory.quantity !== product.inventory.quantity");
    expect(source).toContain("INVENTORY_CONFLICT:");
    expect(source).toContain("Refresh the products page and apply the bulk edit again.");
  });

  it("records a correction movement for successful quantity changes", () => {
    expect(source).toContain('type: "CORRECTION"');
    expect(source).toContain("quantityChange: nextQuantity - currentInventory.quantity");
    expect(source).toContain("quantityAfter: nextQuantity");
    expect(source).toContain('note: "Bulk edit"');
  });
});
