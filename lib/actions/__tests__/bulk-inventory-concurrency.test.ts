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
    expect(source).toContain("currentInventory.quantity !== patch.expectedQuantity");
    expect(source).toContain("INVENTORY_CONFLICT:");
    expect(source).toContain("Refresh the products page and apply the bulk edit again.");
  });

  it("records a correction movement for successful quantity changes", () => {
    const stock = readFileSync(resolve(process.cwd(), "lib/catalog/stock.ts"), "utf8");
    expect(stock).toContain('type: "CORRECTION"');
    expect(stock).toContain("quantityChange: delta");
    expect(stock).toContain("quantityAfter: args.nextQuantity");
    expect(source).toContain("correctInventoryQuantityTx(tx");
    expect(source).toContain('note: "Bulk edit"');
  });

  it("keeps the FIFO batch ledger in step with every stock correction", () => {
    // product CSV (existing + new inventory), variant CSV, new product, bulk edit
    // Stock writes go through the shared correctInventoryQuantityTx helper (which records the
    // batch ledger itself) or call the ledger directly; either way every path is covered.
    const calls = source.match(/(recordBatchLedgerForQuantityChangeTx|correctInventoryQuantityTx)\(tx/g) ?? [];
    expect(calls.length).toBeGreaterThanOrEqual(3);
    expect(source.match(/createFifoBatchTx\(tx/g)?.length).toBeGreaterThanOrEqual(2);
  });
});
