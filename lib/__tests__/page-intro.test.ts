import { describe, expect, it } from "vitest";
import { ownerPageIntro, sanitizeIntro } from "@/lib/storefront/page-intro";

describe("page intro", () => {
  it("keeps trimmed text, drops empties and non-strings, and enforces limits", () => {
    expect(sanitizeIntro({ eyebrow: "  Our   story ", heading: "", subtitle: 5 })).toEqual({ eyebrow: "Our story" });
    expect(sanitizeIntro({ heading: "x".repeat(500) }).heading).toHaveLength(120);
  });
  it("ignores junk input", () => {
    expect(sanitizeIntro(null)).toEqual({});
    expect(sanitizeIntro([1, 2])).toEqual({});
    expect(ownerPageIntro({ body: "hi" })).toEqual({});
    expect(ownerPageIntro({ body: "hi", intro: { subtitle: "Hello" } })).toEqual({ subtitle: "Hello" });
  });
});
