import { describe, expect, it } from "vitest";
import { firstName, maskEmail } from "../mask-pii";

describe("maskEmail", () => {
  it("masks local part and domain but keeps the TLD", () => {
    expect(maskEmail("jane.doe@gmail.com")).toBe("j•••@g•••.com");
  });
  it("never returns the full address", () => {
    expect(maskEmail("a@b.co")).not.toContain("a@b.co");
  });
  it("handles missing and malformed input", () => {
    expect(maskEmail(null)).toBeNull();
    expect(maskEmail("")).toBeNull();
    expect(maskEmail("nonsense")).toBe("•••");
  });
});

describe("firstName", () => {
  it("returns only the first name", () => {
    expect(firstName("  Jane Q. Doe ")).toBe("Jane");
  });
  it("falls back when empty", () => {
    expect(firstName(null)).toBe("Guest");
    expect(firstName("   ", "Friend")).toBe("Friend");
  });
});
