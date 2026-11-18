import { describe, expect, it } from "vitest";
import { normalizeText, readTextOverrides, sanitizeTextOverrides } from "@/lib/storefront/text-overrides";

describe("text overrides", () => {
  it("normalises whitespace in keys", () => {
    expect(normalizeText("  Shop \n  now ")).toBe("Shop now");
    expect(sanitizeTextOverrides({ "  Shop   now ": "  Buy today " })).toEqual({ "Shop now": "Buy today" });
  });
  it("drops empty, non-string and oversized entries", () => {
    const out = sanitizeTextOverrides({ a: "", b: 3, [("x").repeat(301)]: "no", ok: "yes", z: "y".repeat(801) });
    expect(out).toEqual({ ok: "yes" });
  });
  it("ignores junk and reads from storefrontConfig", () => {
    expect(sanitizeTextOverrides(null)).toEqual({});
    expect(sanitizeTextOverrides([1])).toEqual({});
    expect(readTextOverrides({ promoPopup: {}, textOverrides: { Home: "Start" } })).toEqual({ Home: "Start" });
    expect(readTextOverrides(undefined)).toEqual({});
  });
});
