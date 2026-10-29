import { beforeEach, describe, expect, it, vi } from "vitest";

const rate = vi.fn();
const count = vi.fn();

vi.mock("@/lib/rate-limit", () => ({ checkRateLimit: (...a: unknown[]) => rate(...a) }));
vi.mock("@/lib/prisma", () => ({ prisma: { booking: { count: (...a: unknown[]) => count(...a) } } }));

import { enforceGuestBookingLimits, GUEST_BOOKING_LIMITS } from "../guest-booking-limits";

const base = {
  storeId: "s1",
  ip: "1.2.3.4",
  guest: { email: "a@b.co", phone: "0800" },
  holdCutoff: new Date(),
};

beforeEach(() => {
  rate.mockReset().mockResolvedValue({ allowed: true });
  count.mockReset().mockResolvedValue(0);
});

describe("enforceGuestBookingLimits", () => {
  it("allows a normal guest", async () => {
    expect(await enforceGuestBookingLimits(base)).toEqual({ ok: true });
  });

  it("is keyed per IP, so rotating the email does not help", async () => {
    await enforceGuestBookingLimits({ ...base, guest: { email: "x1@b.co", phone: "1" } });
    await enforceGuestBookingLimits({ ...base, guest: { email: "x2@b.co", phone: "2" } });
    const keys = rate.mock.calls.map((c) => c[0]);
    expect(keys.filter((k) => k === "booking-guest-ip:1.2.3.4")).toHaveLength(2);
  });

  it("blocks when the IP burst limit is hit", async () => {
    rate.mockImplementation(async (key: string) => ({ allowed: !key.startsWith("booking-guest-ip:") }));
    const r = await enforceGuestBookingLimits(base);
    expect(r.ok).toBe(false);
  });

  it("blocks when the store limit is hit", async () => {
    rate.mockImplementation(async (key: string) => ({ allowed: !key.startsWith("booking-guest-store:") }));
    expect((await enforceGuestBookingLimits(base)).ok).toBe(false);
  });

  it("skips IP buckets for an unknown IP but still applies store limits", async () => {
    await enforceGuestBookingLimits({ ...base, ip: "unknown" });
    const keys = rate.mock.calls.map((c) => c[0] as string);
    expect(keys.some((k) => k.startsWith("booking-guest-ip"))).toBe(false);
    expect(keys).toContain("booking-guest-store:s1");
  });

  it("blocks too many unpaid holds for one contact", async () => {
    count.mockResolvedValueOnce(GUEST_BOOKING_LIMITS.maxHoldsPerContact).mockResolvedValueOnce(0);
    expect((await enforceGuestBookingLimits(base)).ok).toBe(false);
  });

  it("blocks when the store has too many concurrent guest holds", async () => {
    count.mockResolvedValueOnce(0).mockResolvedValueOnce(GUEST_BOOKING_LIMITS.maxGuestHoldsPerStore);
    expect((await enforceGuestBookingLimits(base)).ok).toBe(false);
  });
});
