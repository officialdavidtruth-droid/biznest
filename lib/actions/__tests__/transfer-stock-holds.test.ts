import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const read = (p: string) => readFileSync(resolve(process.cwd(), p), "utf8");

describe("stock held by unpaid bank-transfer orders", () => {
  const holds = read("lib/payments/stock-holds.ts");
  const order = read("lib/actions/order.ts");
  it("only counts open bank-transfer orders, and not the shopper's own", () => {
    expect(holds).toContain('status: "PENDING_PAYMENT"');
    expect(holds).toContain('paymentProvider: "CASH"');
    expect(holds).toContain("buyerId: { not: opts.excludeBuyerId }");
  });
  it("checkout subtracts the held units from what it treats as available", () => {
    expect(order).toContain("getTransferHolds(store.id");
    expect(order).toContain("holds.byVariant.get(variant.id)");
    expect(order).toContain("holds.byProduct.get(product.id)");
  });
});
