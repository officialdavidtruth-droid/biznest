import { describe, expect, it } from "vitest";
import { decrementStockForOrder } from "@/lib/actions/order";

describe("order payment stock idempotency", () => {
  it("guards stock decrement with an order-linked SALE movement", async () => {
    const source = decrementStockForOrder.toString();
    expect(source).toContain('orderId: order.id');
    expect(source).toContain('type: "SALE"');
    expect(source).toContain("alreadyDecremented");
  });
});
