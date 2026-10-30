import { describe, expect, it } from "vitest";
import { readableAccentText } from "@/lib/utils/readable-accent";

function ratio(a: string, b: string) {
  const lum = (h: string) => {
    const v = [1, 3, 5].map((i) => parseInt(h.slice(i, i + 2), 16) / 255).map((c) => (c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4));
    return 0.2126 * v[0] + 0.7152 * v[1] + 0.0722 * v[2];
  };
  const [hi, lo] = [lum(a), lum(b)].sort((x, y) => y - x);
  return (hi + 0.05) / (lo + 0.05);
}

describe("readableAccentText", () => {
  it("keeps an accent that already reads", () => {
    expect(readableAccentText("#155EEF", "#ffffff")).toBe("#155EEF");
  });
  it("darkens a light accent on a light surface to at least 4.5:1", () => {
    for (const accent of ["#f4c60d", "#9fe52e", "#c9a86a", "#79a7ff"]) {
      expect(ratio(readableAccentText(accent, "#ffffff"), "#ffffff")).toBeGreaterThanOrEqual(4.5);
    }
  });
  it("leaves a light accent alone on a dark surface", () => {
    expect(readableAccentText("#f4c60d", "#07100D")).toBe("#f4c60d");
  });
  it("returns the input untouched when a color isn't a hex", () => {
    expect(readableAccentText("var(--x)", "#ffffff")).toBe("var(--x)");
  });
});
