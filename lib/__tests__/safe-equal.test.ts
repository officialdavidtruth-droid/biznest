import { describe, expect, it } from "vitest";
import { safeEqualEmail } from "../safe-equal";

describe("safeEqualEmail", () => {
  it("matches case-insensitively and ignores surrounding spaces", () => {
    expect(safeEqualEmail("Jane@Example.com", "  jane@example.com ")).toBe(true);
  });
  it("rejects different values, including different lengths", () => {
    expect(safeEqualEmail("a@b.co", "a@b.com")).toBe(false);
    expect(safeEqualEmail("a@b.co", "c@d.co")).toBe(false);
  });
  it("rejects missing values", () => {
    expect(safeEqualEmail(null, "a@b.co")).toBe(false);
    expect(safeEqualEmail("a@b.co", undefined)).toBe(false);
    expect(safeEqualEmail("", "")).toBe(false);
  });
});
