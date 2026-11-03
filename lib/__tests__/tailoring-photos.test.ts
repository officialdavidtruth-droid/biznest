import { describe, expect, it } from "vitest";
import { isTailoringPhotoUrl, parseTailoringPhotos, tailoringBalance, MAX_TAILORING_PHOTOS } from "@/lib/tailoring";

const ok = "https://res.cloudinary.com/demo/image/upload/v1/biznest/a.jpg";

describe("isTailoringPhotoUrl", () => {
  it("accepts Cloudinary https images only", () => {
    expect(isTailoringPhotoUrl(ok)).toBe(true);
    expect(isTailoringPhotoUrl("http://res.cloudinary.com/demo/a.jpg")).toBe(false);
    expect(isTailoringPhotoUrl("https://evil.example/a.jpg")).toBe(false);
    expect(isTailoringPhotoUrl("javascript:alert(1)")).toBe(false);
    expect(isTailoringPhotoUrl("https://res.cloudinary.com.evil.example/a.jpg")).toBe(false);
    expect(isTailoringPhotoUrl(42)).toBe(false);
    expect(isTailoringPhotoUrl("x".repeat(700))).toBe(false);
  });
});

describe("parseTailoringPhotos", () => {
  it("ignores junk and defaults the kind to reference", () => {
    const out = parseTailoringPhotos([{ url: ok }, { url: ok, kind: "progress", caption: " Cut done " }, { url: "https://x.example/a.jpg" }, null, "str"]);
    expect(out).toHaveLength(2);
    expect(out[0].kind).toBe("reference");
    expect(out[1]).toMatchObject({ kind: "progress", caption: "Cut done" });
  });
  it("returns [] for non-arrays and caps the count", () => {
    expect(parseTailoringPhotos(null)).toEqual([]);
    expect(parseTailoringPhotos({})).toEqual([]);
    expect(parseTailoringPhotos(Array.from({ length: 30 }, () => ({ url: ok })))).toHaveLength(MAX_TAILORING_PHOTOS);
  });
});

describe("tailoringBalance", () => {
  it("never goes negative and is null without a price", () => {
    expect(tailoringBalance(null, 0)).toBeNull();
    expect(tailoringBalance(10000, 2500.5)).toBe(7499.5);
    expect(tailoringBalance(10000, 12000)).toBe(0);
  });
});
