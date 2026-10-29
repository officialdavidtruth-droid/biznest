import { describe, expect, it } from "vitest";
import { GUEST_INPUT_LIMITS, normalizePhone, validateGuest, validateNotes } from "../guest-validation";

const ok = { name: "Jane Doe", email: "Jane@Example.com", phone: "+234 801 234 5678" };

describe("validateGuest", () => {
  it("normalizes a valid guest", () => {
    expect(validateGuest(ok)).toEqual({ ok: true, guest: { name: "Jane Doe", email: "jane@example.com", phone: "+2348012345678" } });
  });
  it("requires guest details", () => {
    expect(validateGuest(undefined).ok).toBe(false);
    expect(validateGuest({ ...ok, name: "   " }).ok).toBe(false);
  });
  it("rejects oversized name and email", () => {
    expect(validateGuest({ ...ok, name: "a".repeat(GUEST_INPUT_LIMITS.name + 1) }).ok).toBe(false);
    expect(validateGuest({ ...ok, email: "a".repeat(250) + "@b.co" }).ok).toBe(false);
  });
  it("rejects bad email and non-string input", () => {
    expect(validateGuest({ ...ok, email: "nope" }).ok).toBe(false);
    expect(validateGuest({ ...ok, name: { x: 1 } }).ok).toBe(false);
  });
});

describe("normalizePhone", () => {
  it("strips separators", () => expect(normalizePhone("(0801) 234-5678")).toBe("08012345678"));
  it("rejects letters, too short and too long", () => {
    expect(normalizePhone("call me")).toBeNull();
    expect(normalizePhone("12345")).toBeNull();
    expect(normalizePhone("1".repeat(16))).toBeNull();
    expect(normalizePhone(123456789)).toBeNull();
  });
});

describe("validateNotes", () => {
  it("allows empty and normal notes", () => {
    expect(validateNotes("").ok).toBe(true);
    expect(validateNotes(undefined).ok).toBe(true);
    expect(validateNotes("late arrival").ok).toBe(true);
  });
  it("rejects oversized notes", () => {
    expect(validateNotes("x".repeat(GUEST_INPUT_LIMITS.notes + 1)).ok).toBe(false);
  });
});
