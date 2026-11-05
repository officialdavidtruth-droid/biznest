import { describe, expect, it } from "vitest";
import { sanitizePreferences, PREFERENCE_MAX_KEYS, PREFERENCE_MAX_TEXT } from "@/lib/customer-preferences";

describe("sanitizePreferences", () => {
  it("keeps short strings, numbers and booleans", () => {
    expect(sanitizePreferences({ dietary: "Vegan", sms: true, floor: 3 })).toEqual({ dietary: "Vegan", sms: true, floor: 3 });
  });
  it("drops objects, arrays, nulls and bad keys", () => {
    expect(sanitizePreferences({ a: { deep: 1 }, b: [1], c: null, "bad key": "x", "1x": "y", ok: "yes" })).toEqual({ ok: "yes" });
  });
  it("truncates long text and caps the number of keys", () => {
    const out = sanitizePreferences({ note: "x".repeat(5000), ...Object.fromEntries(Array.from({ length: 100 }, (_, i) => [`k${i}`, "v"])) });
    expect((out.note as string).length).toBe(PREFERENCE_MAX_TEXT);
    expect(Object.keys(out).length).toBe(PREFERENCE_MAX_KEYS);
  });
  it("returns an empty object for non-objects", () => {
    expect(sanitizePreferences("hello")).toEqual({});
    expect(sanitizePreferences(null)).toEqual({});
    expect(sanitizePreferences([1, 2])).toEqual({});
  });
});
