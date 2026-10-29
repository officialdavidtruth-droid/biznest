import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

// Behaviour is covered in lib/__tests__/inventory-refund.test.ts; these checks
// only pin the wiring that a behavioural unit test cannot see.
describe("refund inventory restoration wiring", () => {
  const refund = readFileSync(resolve(process.cwd(), "lib/actions/refund.ts"), "utf8");
  const restore = readFileSync(resolve(process.cwd(), "lib/inventory-refund.ts"), "utf8");

  it("uses an order-linked RETURN movement as the duplicate-refund guard", () => {
    expect(restore).toContain('type: "RETURN"');
    expect(restore).toContain('where: { orderId, storeId, type: "RETURN" }');
    expect(restore).toContain("if (existingReturn) return false;");
  });

  it("runs restoration during both cash and gateway refund finalization", () => {
    expect(refund).toContain("restoreInventoryForRefund(tx, order.id, access.store.id)");
    expect(refund).toContain("restoreInventoryForRefund(tx, payment.order.id, store.id)");
  });

  it("keeps the restore helper out of the \"use server\" file (it takes a raw transaction client)", () => {
    expect(refund).not.toMatch(/export (async )?function restoreInventoryForRefund/);
    expect(restore).not.toMatch(/^\s*["']use server["']/);
  });
});
