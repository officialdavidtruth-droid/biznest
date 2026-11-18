import { beforeAll, describe, expect, it } from "vitest";
import { orderTrackingToken, orderTrackingUrl, verifyOrderTrackingToken } from "@/lib/order-tracking";

beforeAll(() => { process.env.AUTH_SECRET = "test-secret"; });

describe("order tracking token", () => {
  it("verifies for its own order only", () => {
    const t = orderTrackingToken("order_1");
    expect(verifyOrderTrackingToken("order_1", t)).toBe(true);
    expect(verifyOrderTrackingToken("order_2", t)).toBe(false);
  });
  it("rejects missing, wrong-length and tampered tokens", () => {
    const t = orderTrackingToken("order_1");
    expect(verifyOrderTrackingToken("order_1", undefined)).toBe(false);
    expect(verifyOrderTrackingToken("order_1", t.slice(1))).toBe(false);
    expect(verifyOrderTrackingToken("order_1", "x".repeat(t.length))).toBe(false);
  });
  it("builds a path-based store link", () => {
    const url = orderTrackingUrl("https://biznest.space/", "shop", "order_1");
    expect(url).toBe(`https://biznest.space/shop/order-status/order_1?t=${orderTrackingToken("order_1")}`);
  });
});
