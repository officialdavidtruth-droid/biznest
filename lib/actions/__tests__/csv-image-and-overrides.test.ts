import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const read = (p: string) => readFileSync(resolve(process.cwd(), p), "utf8");

describe("CSV product images", () => {
  const source = read("lib/actions/bulk.ts");
  it("exports and imports an imageUrl column, validated", () => {
    expect(source).toContain('"imageUrl"');
    expect(source).toContain("parseImageUrl(r.imageUrl)");
    expect(source).toContain("isSafeImageUrl");
  });
  it("creates new products with the image", () => {
    expect(source).toContain("images: newImage ? [newImage] : []");
  });
});

describe("sectionOverrides writes", () => {
  it("builder saves go through the locked helper, not read-modify-write", () => {
    const builder = read("lib/actions/builder.ts");
    expect(builder).toContain("updateSectionOverridesJson");
    expect(builder).not.toContain("access.store.sectionOverrides");
    expect(read("lib/store-overrides.ts")).toContain("FOR UPDATE");
  });
});
