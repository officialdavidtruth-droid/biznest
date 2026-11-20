import { describe, expect, it, vi } from "vitest";
vi.mock("server-only", () => ({}));
vi.mock("@/lib/prisma", () => ({ prisma: {} }));
vi.mock("@/lib/actions/site-settings", () => ({ getActiveGateway: vi.fn() }));
import { pickUniqueAmount } from "@/lib/payments/transfer-intent";

describe("pickUniqueAmount", () => {
  it("adds 1-99 kobo to the payable total", () => {
    for (let i = 0; i < 50; i++) {
      const a = pickUniqueAmount(359094, [])!;
      expect(a).toBeGreaterThan(359094);
      expect(a).toBeLessThanOrEqual(359094.99);
    }
  });
  it("never returns an amount another open order of the store is waiting on", () => {
    const taken = Array.from({ length: 98 }, (_, i) => 1000 + (i + 1) / 100); // .01 to .98 taken
    expect(pickUniqueAmount(1000, taken)).toBe(1000.99);
  });
  it("treats a different order's total + kobo as taken too", () => {
    expect(pickUniqueAmount(1000, [1000.5])).not.toBe(1000.5);
  });
  it("returns null when all 99 values are taken", () => {
    const taken = Array.from({ length: 99 }, (_, i) => 1000 + (i + 1) / 100);
    expect(pickUniqueAmount(1000, taken)).toBeNull();
  });
});
