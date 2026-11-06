import { beforeEach, describe, expect, it, vi } from "vitest";

const m = vi.hoisted(() => ({
  prisma: {
    user: { findFirst: vi.fn(), create: vi.fn() },
    verificationToken: { create: vi.fn() },
    business: { create: vi.fn() },
    store: { create: vi.fn() },
    storeCustomer: { create: vi.fn() },
  },
  checkRateLimit: vi.fn(), sendVerificationEmail: vi.fn(),
}));

vi.mock("@/lib/prisma", () => ({ prisma: m.prisma }));
vi.mock("next/headers", () => ({ headers: async () => new Headers({ "x-forwarded-for": "203.0.113.9" }) }));
vi.mock("@/lib/rate-limit", () => ({ checkRateLimit: m.checkRateLimit, getClientIp: () => "203.0.113.9" }));
vi.mock("@/lib/email/send", () => ({ sendVerificationEmail: m.sendVerificationEmail }));
vi.mock("nanoid", () => ({ nanoid: () => "tok123" }));
vi.mock("bcryptjs", () => ({ default: { hash: async () => "hashed" } }));

import { registerMember } from "@/lib/actions/member";

const input = { name: "Amaka Chukwu", email: "Amaka@Example.com", password: "Sup3rSecret!", confirmPassword: "Sup3rSecret!" };

beforeEach(() => {
  vi.clearAllMocks();
  m.checkRateLimit.mockResolvedValue({ allowed: true });
  m.prisma.user.findFirst.mockResolvedValue(null);
  m.prisma.user.create.mockResolvedValue({ id: "u1", email: "amaka@example.com" });
  m.prisma.verificationToken.create.mockResolvedValue({ token: "tok123" });
  m.sendVerificationEmail.mockResolvedValue(undefined);
});

describe("registerMember", () => {
  it("creates a plain MEMBER with no business, store or customer row", async () => {
    const r = await registerMember(input as never);
    expect(r).toEqual({ success: true, data: { userId: "u1" } });
    const data = m.prisma.user.create.mock.calls[0][0].data;
    expect(data).toMatchObject({ role: "MEMBER", email: "amaka@example.com", customerScopeStoreId: null, passwordHash: "hashed" });
    expect(m.prisma.business.create).not.toHaveBeenCalled();
    expect(m.prisma.store.create).not.toHaveBeenCalled();
    expect(m.prisma.storeCustomer.create).not.toHaveBeenCalled();
  });
  it("rejects an email that already has a BizNest account", async () => {
    m.prisma.user.findFirst.mockResolvedValue({ id: "x" });
    const r = await registerMember(input as never);
    expect(r.success).toBe(false);
    expect(m.prisma.user.create).not.toHaveBeenCalled();
  });
  it("rejects invalid input", async () => {
    const r = await registerMember({ ...input, confirmPassword: "different" } as never);
    expect(r.success).toBe(false);
    expect(m.prisma.user.create).not.toHaveBeenCalled();
  });
  it("is rate limited", async () => {
    m.checkRateLimit.mockResolvedValue({ allowed: false, retryAfterSeconds: 600 });
    expect((await registerMember(input as never)).success).toBe(false);
    expect(m.prisma.user.findFirst).not.toHaveBeenCalled();
  });
  it("still succeeds if the verification email fails", async () => {
    m.sendVerificationEmail.mockRejectedValue(new Error("smtp down"));
    expect((await registerMember(input as never)).success).toBe(true);
  });
});
