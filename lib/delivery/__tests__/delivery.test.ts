import { describe, expect, it } from "vitest";
import { cleanTrackingUrl, deliveryStatusLabel, isDeliveryStatus } from "@/lib/delivery";

describe("cleanTrackingUrl", () => {
  it("accepts http(s) links and trims", () => {
    expect(cleanTrackingUrl("  https://kwik.delivery/track/abc  ")).toBe("https://kwik.delivery/track/abc");
    expect(cleanTrackingUrl("http://example.com/x")).toBe("http://example.com/x");
  });
  it("rejects anything else, since it is shown to customers and put in messages", () => {
    expect(cleanTrackingUrl("javascript:alert(1)")).toBeNull();
    expect(cleanTrackingUrl("ftp://example.com")).toBeNull();
    expect(cleanTrackingUrl("https://user:pw@example.com")).toBeNull();
    expect(cleanTrackingUrl("not a url")).toBeNull();
    expect(cleanTrackingUrl("")).toBeNull();
    expect(cleanTrackingUrl(null)).toBeNull();
  });
});

describe("statuses", () => {
  it("validates and labels", () => {
    expect(isDeliveryStatus("OUT_FOR_DELIVERY")).toBe(true);
    expect(isDeliveryStatus("LOST")).toBe(false);
    expect(deliveryStatusLabel("OUT_FOR_DELIVERY")).toBe("Out for delivery");
    expect(deliveryStatusLabel("weird")).toBe("weird");
  });
});
