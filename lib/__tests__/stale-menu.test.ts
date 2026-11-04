import { describe, expect, it } from "vitest";
import { isStaleMenu } from "@/lib/storefront-menu";

describe("stale custom menu", () => {
  it("falls back to the default menu when dead page links leave one stray link", () => {
    expect(isStaleMenu(5, 1, 1)).toBe(true);
  });
  it("keeps a menu the owner built with every link still valid", () => {
    expect(isStaleMenu(1, 1, 1)).toBe(false);
    expect(isStaleMenu(4, 4, 4)).toBe(false);
  });
  it("keeps a menu that lost a link but still has several", () => {
    expect(isStaleMenu(5, 3, 3)).toBe(false);
  });
  it("has nothing to judge without rows", () => {
    expect(isStaleMenu(0, 0, 0)).toBe(false);
  });
});
