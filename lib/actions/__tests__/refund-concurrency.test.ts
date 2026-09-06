import { describe, expect, it } from "vitest";
import fs from "fs";

describe("refund concurrency guard", () => {
  it("claims REFUND_PENDING before the gateway call", () => {
    const source = fs.readFileSync("lib/actions/refund.ts", "utf8");
    const claim = source.indexOf('status: "REFUND_PENDING"');
    const gateway = source.indexOf("await refundPayment({");
    expect(claim).toBeGreaterThan(-1);
    expect(gateway).toBeGreaterThan(claim);
  });
  it("defines the durable refund-pending payment state", () => {
    const schema = fs.readFileSync("prisma/schema.prisma", "utf8");
    expect(schema).toMatch(/enum PaymentStatus[\\s\\S]*REFUND_PENDING[\\s\\S]*REFUNDED/);
  });
});
