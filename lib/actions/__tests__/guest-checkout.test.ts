import { beforeEach, describe, expect, it, vi } from "vitest";

const m = vi.hoisted(() => ({
  prisma: {
    store: { findUnique: vi.fn() },
    user: { findFirst: vi.fn(), create: vi.fn() },
    storeCustomer: { create: vi.fn() },
  },
  rate: vi.fn(), session: vi.fn(), profile: vi.fn(),
}));

vi.mock("@/lib/prisma", () => ({ prisma: m.prisma }));
vi.mock("next/headers", () => ({ headers: async () => new Headers() }));
vi.mock("@/lib/rate-limit", () => ({ checkRateLimit: m.rate, getClientIp: () => "1.2.3.4" }));
vi.mock("@/lib/store-customer-auth", () => ({ createStoreCustomerSession: m.session }));
vi.mock("@/lib/customer-profile-store", () => ({ ensureAccountProfile: m.profile }));

import { continueAsGuest } from "@/lib/actions/guest-checkout";

const good = { name: "Ada Obi", email: "Ada@Example.com", phone: "08012345678" };

beforeEach(() => {
  vi.clearAllMocks();
  m.rate.mockResolvedValue({ allowed: true });
  m.prisma.store.findUnique.mockResolvedValue({ id: "s1", status: "ACTIVE" });
  m.prisma.user.findFirst.mockResolvedValue(null);
  m.prisma.user.create.mockResolvedValue({ id: "u1" });
});

describe("continueAsGuest", () => {
  it("creates a passwordless store customer and signs them in", async () => {
    expect(await continueAsGuest("shop", good)).toEqual({ success: true, data: undefined });
    const data = m.prisma.user.create.mock.calls[0][0].data;
    expect(data).toMatchObject({ email: "ada@example.com", role: "CUSTOMER", customerScopeStoreId: "s1" });
    expect(data.passwordHash).toBeUndefined();
    expect(m.prisma.storeCustomer.create).toHaveBeenCalledWith({ data: { userId: "u1", storeId: "s1" } });
    expect(m.session).toHaveBeenCalledWith("u1", "s1");
  });

  it("never signs in to an existing account for that email", async () => {
    m.prisma.user.findFirst.mockResolvedValue({ id: "old" });
    const r = await continueAsGuest("shop", good);
    expect(r.success).toBe(false);
    expect(m.session).not.toHaveBeenCalled();
    expect(m.prisma.user.create).not.toHaveBeenCalled();
  });

  it("rejects bad details, unavailable stores and rate-limited callers", async () => {
    expect((await continueAsGuest("shop", { ...good, email: "nope" })).success).toBe(false);
    m.prisma.store.findUnique.mockResolvedValue({ id: "s1", status: "SUSPENDED" });
    expect((await continueAsGuest("shop", good)).success).toBe(false);
    m.rate.mockResolvedValue({ allowed: false });
    expect((await continueAsGuest("shop", good)).success).toBe(false);
    expect(m.session).not.toHaveBeenCalled();
  });
});
