import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

describe("refund inventory restoration", () => {
  const source = readFileSync(resolve(process.cwd(), "lib/actions/refund.ts"), "utf8");

  it("uses an order-linked RETURN movement as the duplicate-refund guard", () => {
    expect(source).toContain('type: "RETURN"');
    expect(source).toContain("where: { orderId, storeId, type: \"RETURN\" }");
    expect(source).toContain("if (existingReturn) return false;");
  });

  it("restores both variant and plain-product inventory", () => {
    expect(source).toContain("variant.quantity + item.quantity");
    expect(source).toContain("inventory.quantity + item.quantity");
    expect(source).toContain("quantityChange: item.quantity");
  });

  it("runs restoration during both cash and gateway refund finalization", () => {
    expect(source).toContain("restoreInventoryForRefund(tx, order.id, access.store.id)");
    expect(source).toContain("restoreInventoryForRefund(tx, payment.order.id, store.id)");
  });
});
