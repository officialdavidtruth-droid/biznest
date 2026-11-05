import { describe, expect, it } from "vitest";
import { abandonedCartText, deliveryUpdateText, orderNumber, orderStatusText, reviewRequestText } from "@/lib/customer-messages";

const ctx = { storeName: "Zara Fabrics", orderNo: "AB12CD34" };

describe("orderStatusText", () => {
  it("names the store and order number, never the platform", () => {
    for (const status of ["PAID", "IN_PROGRESS", "DELIVERED", "COMPLETED", "CANCELLED"]) {
      const text = orderStatusText(status, ctx)!;
      expect(text).toContain("Zara Fabrics");
      expect(text).toContain("AB12CD34");
      expect(text).not.toMatch(/biznest/i);
    }
  });

  it("stays quiet for statuses customers shouldn't be messaged about", () => {
    expect(orderStatusText("PENDING_PAYMENT", ctx)).toBeNull();
    expect(orderStatusText("DISPUTED", ctx)).toBeNull();
    expect(orderStatusText("REFUNDED", ctx)).toBeNull();
  });

  it("says 'on its way' with the tracking link when the order is out for delivery", () => {
    const text = orderStatusText("DELIVERED", { ...ctx, trackingUrl: "https://track.example/1", deliveryStatus: "OUT_FOR_DELIVERY" })!;
    expect(text).toMatch(/on its way/);
    expect(text).toContain("https://track.example/1");
  });
});

describe("deliveryUpdateText", () => {
  it("includes rider details and the tracking link", () => {
    const text = deliveryUpdateText("OUT_FOR_DELIVERY", { ...ctx, trackingUrl: "https://t.example/x", riderName: "Musa", riderPhone: "0803 000 0000" })!;
    expect(text).toContain("out for delivery");
    expect(text).toContain("Musa (0803 000 0000)");
    expect(text).toContain("https://t.example/x");
  });

  it("handles a rider with only a phone, and unknown statuses", () => {
    expect(deliveryUpdateText("BOOKED", { ...ctx, riderPhone: "0803" })).toContain("Rider: 0803.");
    expect(deliveryUpdateText("NOPE", ctx)).toBeNull();
  });
});

describe("other copy", () => {
  it("builds abandoned-cart and review messages around the store", () => {
    expect(abandonedCartText({ storeName: "Zara", itemLabel: "Ankara dress +1 more", cartUrl: "https://z.example/cart" })).toBe(
      "You left Ankara dress +1 more in your cart at Zara. Complete your order here: https://z.example/cart"
    );
    expect(reviewRequestText({ storeName: "Zara", reviewUrl: "https://z.example/r", kind: "order" })).toContain("your order from Zara");
    expect(reviewRequestText({ storeName: "Zara", reviewUrl: "https://z.example/r", kind: "booking" })).toContain("visiting Zara");
  });

  it("matches the admin order number format", () => {
    expect(orderNumber("cm1234567890abcdef")).toBe("90ABCDEF");
  });
});
