import { beforeEach, describe, expect, it, vi } from "vitest";

const m = vi.hoisted(() => ({
  prisma: { store: { findUnique: vi.fn() }, order: { findFirst: vi.fn() }, user: { findUnique: vi.fn(), update: vi.fn() } },
  rate: vi.fn(), session: vi.fn(),
}));
vi.mock("@/lib/prisma", () => ({ prisma: m.prisma }));
vi.mock("next/headers", () => ({ headers: async () => new Headers() }));
vi.mock("@/lib/rate-limit", () => ({ checkRateLimit: m.rate, getClientIp: () => "1.1.1.1" }));
vi.mock("@/lib/store-customer-auth", () => ({ getStoreCustomerSessionForStore: m.session }));

import { findOrderToTrack, setGuestPassword } from "@/lib/actions/order-lookup";

beforeEach(() => {
  vi.clearAllMocks();
  process.env.AUTH_SECRET = "test-secret";
  m.rate.mockResolvedValue({ allowed: true });
  m.prisma.store.findUnique.mockResolvedValue({ id: "s1" });
});

describe("findOrderToTrack", () => {
  it("returns the tracking path when number and email match", async () => {
    m.prisma.order.findFirst.mockResolvedValue({ id: "cabc12345678" });
    const r = await findOrderToTrack("shop", "#12345678", "A@B.com");
    expect(r.success && r.data.path).toMatch(/^\/store\/shop\/order-status\/cabc12345678\?t=/);
    const where = m.prisma.order.findFirst.mock.calls[0][0].where;
    expect(where).toMatchObject({ storeId: "s1", id: { endsWith: "12345678" }, buyer: { email: { equals: "a@b.com" } } });
  });
  it("gives the same answer for a wrong order, a bad email and a rate limit's neighbour", async () => {
    m.prisma.order.findFirst.mockResolvedValue(null);
    const a = await findOrderToTrack("shop", "12345678", "a@b.com");
    const b = await findOrderToTrack("shop", "12", "a@b.com");
    const c = await findOrderToTrack("shop", "12345678", "nope");
    expect(a).toEqual(b); expect(b).toEqual(c); expect(a.success).toBe(false);
  });
  it("is rate limited", async () => {
    m.rate.mockResolvedValue({ allowed: false });
    expect((await findOrderToTrack("shop", "12345678", "a@b.com")).success).toBe(false);
    expect(m.prisma.order.findFirst).not.toHaveBeenCalled();
  });
});

describe("setGuestPassword", () => {
  it("needs the guest's own session and an account without a password", async () => {
    m.session.mockResolvedValue(null);
    expect((await setGuestPassword("shop", "longenough1")).success).toBe(false);
    m.session.mockResolvedValue({ user: { id: "u1" } });
    m.prisma.user.findUnique.mockResolvedValue({ passwordHash: "x" });
    expect((await setGuestPassword("shop", "longenough1")).success).toBe(false);
    m.prisma.user.findUnique.mockResolvedValue({ passwordHash: null });
    expect((await setGuestPassword("shop", "short")).success).toBe(false);
    expect(m.prisma.user.update).not.toHaveBeenCalled();
    expect((await setGuestPassword("shop", "longenough1")).success).toBe(true);
    expect(m.prisma.user.update.mock.calls[0][0].data.passwordHash).toMatch(/^\$2/);
  });
});
