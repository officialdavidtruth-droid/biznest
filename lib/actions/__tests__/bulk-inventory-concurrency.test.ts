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
    expect(source).toContain('type: "CORRECTION"');
    expect(source).toContain("const bulkDelta = nextQuantity - currentInventory.quantity");
    expect(source).toContain("quantityChange: bulkDelta");
    expect(source).toContain("quantityAfter: nextQuantity");
    expect(source).toContain('note: "Bulk edit"');
  });

  it("keeps the FIFO batch ledger in step with every stock correction", () => {
    // product CSV (existing + new inventory), variant CSV, new product, bulk edit
    const calls = source.match(/recordBatchLedgerForQuantityChangeTx\(tx/g) ?? [];
    expect(calls.length).toBeGreaterThanOrEqual(3);
    expect(source.match(/createFifoBatchTx\(tx/g)?.length).toBeGreaterThanOrEqual(2);
  });
});
