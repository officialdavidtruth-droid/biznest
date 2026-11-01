import { describe, expect, it } from "vitest";
import { contrastRatio, deriveReadableTheme } from "@/lib/storefront/readable-design";

describe("deriveReadableTheme", () => {
  it("replaces dark text on a dark background (the unreadable Shop page)", () => {
    const out = deriveReadableTheme("#06280b", { ink: "#14301a", muted: "#2a4a30", card: "#f4f6f3" });
    expect(contrastRatio(out.ink, "#06280b")).toBeGreaterThanOrEqual(4.5);
    expect(contrastRatio(out.muted, "#06280b")).toBeGreaterThanOrEqual(4.5);
    expect(contrastRatio(out.ink, out.card)).toBeGreaterThanOrEqual(4.5);
  });
  it("keeps colours that are already readable", () => {
    const out = deriveReadableTheme("#ffffff", { ink: "#111111", muted: "#555555", card: "#ffffff", border: "#dddddd" }, { ink: true });
    expect(out.ink).toBe("#111111");
    expect(out.muted).toBe("#555555");
    expect(out.card).toBe("#ffffff");
  });
  it("respects an owner-chosen card colour when text is readable on it", () => {
    const out = deriveReadableTheme("#06280b", { ink: "#f4f6f3", card: "#103a16" }, { card: true, ink: true });
    expect(out.card).toBe("#103a16");
  });
});
