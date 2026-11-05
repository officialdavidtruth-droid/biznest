import { describe, expect, it } from "vitest";
import { accountAccent, accountThemeStyle, normalizeHex, readableOn } from "@/lib/account-theme";

describe("account theme", () => {
  it("normalises hex colours and rejects junk", () => {
    expect(normalizeHex("#ABC")).toBe("#aabbcc");
    expect(normalizeHex("0b5d4b")).toBe("#0b5d4b");
    expect(normalizeHex("red; background:url(x)")).toBe("#111827");
    expect(normalizeHex(undefined)).toBe("#111827");
  });
  it("picks readable text for the accent", () => {
    expect(readableOn("#0b5d4b")).toBe("#ffffff");
    expect(readableOn("#fde68a")).toBe("#0f172a");
  });
  it("falls back to a dark accent when the store colour is nearly white", () => {
    expect(accountAccent({ primary: "#ffffff" })).toBe("#111827");
    expect(accountAccent({ primary: "#0b5d4b" })).toBe("#0b5d4b");
    expect(accountAccent(null)).toBe("#111827");
  });
  it("only ever emits safe CSS variable values", () => {
    const s = accountThemeStyle({ primary: "javascript:alert(1)" });
    expect(s["--acx-accent"]).toBe("#111827");
    expect(s["--acx-on-accent"]).toBe("#ffffff");
  });
});

import { accentInk } from "@/lib/account-theme";
describe("accentInk", () => {
  it("keeps dark accents and darkens light ones until they read on white", () => {
    expect(accentInk("#0b5d4b")).toBe("#0b5d4b");
    const ink = accentInk("#fde68a");
    expect(ink).not.toBe("#fde68a");
    const [r, g, b] = [1, 3, 5].map((i) => parseInt(ink.slice(i, i + 2), 16) / 255).map((c) => (c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4));
    expect(1.05 / (0.2126 * r + 0.7152 * g + 0.0722 * b + 0.05)).toBeGreaterThanOrEqual(4.5);
  });
});
