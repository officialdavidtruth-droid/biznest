import { describe, expect, it } from "vitest";
import {
  hasAnyTracking,
  isTrackablePath,
  parseGaId,
  parseMetaPixelId,
  parsePlausibleDomain,
  sanitizeStoredTrackingIds,
} from "@/lib/tracking/ids";

const val = (r: { ok: boolean; value?: string | null }) => (r.ok ? r.value : "ERR");

describe("GA4 measurement id", () => {
  it("normalises case and whitespace; blank means off", () => {
    expect(val(parseGaId("  g-abc123xyz9 "))).toBe("G-ABC123XYZ9");
    expect(val(parseGaId(""))).toBeNull();
    expect(val(parseGaId(undefined))).toBeNull();
  });
  it.each(["UA-12345-1", "GTM-ABCDE", "AW-123456", "G-", "G-AB", "G-ABC 123", "https://x.com", 'G-ABC123XYZ9"></script><script>alert(1)</script>'])(
    "rejects %s",
    (bad) => expect(parseGaId(bad).ok).toBe(false)
  );
});

describe("Meta pixel id", () => {
  it("accepts digits (spaces stripped); blank means off", () => {
    expect(val(parseMetaPixelId(" 123456789012345 "))).toBe("123456789012345");
    expect(val(parseMetaPixelId("1234 5678 9012 345"))).toBe("123456789012345");
    expect(val(parseMetaPixelId(""))).toBeNull();
  });
  it.each(["abc", "12345", "12345678901a", "123456789012345'); alert(1);//", "1".repeat(21)])("rejects %s", (bad) =>
    expect(parseMetaPixelId(bad).ok).toBe(false)
  );
});

describe("Plausible domain", () => {
  it("extracts the bare host from what people paste", () => {
    expect(val(parsePlausibleDomain("MyStore.com"))).toBe("mystore.com");
    expect(val(parsePlausibleDomain("https://www.mystore.com/shop?x=1#y"))).toBe("www.mystore.com");
    expect(val(parsePlausibleDomain("shop.mystore.com.ng"))).toBe("shop.mystore.com.ng");
    expect(val(parsePlausibleDomain(""))).toBeNull();
  });
  it.each(["localhost", "not a domain", "mystore", "-bad.com", "a..com", 'evil.com"onload="x', "javascript:alert(1)"])("rejects %s", (bad) =>
    expect(parsePlausibleDomain(bad).ok).toBe(false)
  );
});

describe("render-time sanitising", () => {
  it("treats junk already in the database as unset instead of trusting it", () => {
    const s = sanitizeStoredTrackingIds({ trackingGaId: "G-ABC123XYZ9", trackingMetaPixelId: "<script>", trackingPlausibleDomain: 'evil"x.com' });
    expect(s).toEqual({ gaId: "G-ABC123XYZ9", metaPixelId: null, plausibleDomain: null });
    expect(hasAnyTracking(s)).toBe(true);
    expect(hasAnyTracking(sanitizeStoredTrackingIds({}))).toBe(false);
  });
});

describe("paths that are never reported to third parties", () => {
  it.each(["/", "/store/x", "/x/product/1", "/x/checkout", "/orders/abc/confirmation"])("tracks %s", (p) => expect(isTrackablePath(p)).toBe(true));
  it.each(["/store/x/admin/settings", "/x/admin", "/x/account/orders", "/store/x/wallet-pay/tok_123", "/account"])("skips %s", (p) =>
    expect(isTrackablePath(p)).toBe(false)
  );
});
