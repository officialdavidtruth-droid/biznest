import { beforeEach, describe, expect, it, vi } from "vitest";

const m = vi.hoisted(() => ({
  storeFindUnique: vi.fn(),
  codeFindUnique: vi.fn(),
  userFindUnique: vi.fn(),
  referralFindUnique: vi.fn(),
  referralCreate: vi.fn(),
  orderCount: vi.fn(),
}));

vi.mock("@prisma/client", () => {
  class PrismaClientKnownRequestError extends Error {
    code: string;
    constructor(message: string, opts: { code: string }) {
      super(message);
      this.code = opts.code;
    }
  }
  return { Prisma: { PrismaClientKnownRequestError } };
});

vi.mock("@/lib/prisma", () => ({
  prisma: {
    store: { findUnique: m.storeFindUnique },
    referralCode: { findUnique: m.codeFindUnique },
    user: { findUnique: m.userFindUnique },
    referral: { findUnique: m.referralFindUnique, create: m.referralCreate },
    order: { count: m.orderCount },
  },
}));

import { attachReferral, canonicalEmail, normalizeReferralCode } from "@/lib/referrals/attach";

const params = { storeId: "s1", refereeId: "u-new", code: "abcd-2345" };

beforeEach(() => {
  vi.clearAllMocks();
  m.storeFindUnique.mockResolvedValue({ referralEnabled: true, referralReferrerPoints: 500, referralRefereePoints: 200 });
  m.codeFindUnique.mockResolvedValue({ id: "c1", userId: "u-ref" });
  m.userFindUnique.mockImplementation(async ({ where }: { where: { id: string } }) => ({ email: where.id === "u-ref" ? "ref@example.com" : "new@example.com" }));
  m.referralFindUnique.mockResolvedValue(null);
  m.orderCount.mockResolvedValue(0);
  m.referralCreate.mockResolvedValue({});
});

describe("attachReferral", () => {
  it("links the friend and snapshots the promised points", async () => {
    const res = await attachReferral(params);
    expect(res).toEqual({ ok: true, refereePoints: 200 });
    expect(m.referralCreate).toHaveBeenCalledWith({
      data: expect.objectContaining({ codeId: "c1", referrerId: "u-ref", refereeId: "u-new", promisedReferrerPoints: 500, promisedRefereePoints: 200 }),
    });
  });

  it("rejects when the program is off", async () => {
    m.storeFindUnique.mockResolvedValue({ referralEnabled: false });
    expect((await attachReferral(params)).ok).toBe(false);
    expect(m.referralCreate).not.toHaveBeenCalled();
  });

  it("rejects an unknown code", async () => {
    m.codeFindUnique.mockResolvedValue(null);
    expect((await attachReferral(params)).ok).toBe(false);
  });

  it("rejects your own code", async () => {
    m.codeFindUnique.mockResolvedValue({ id: "c1", userId: "u-new" });
    expect((await attachReferral(params)).ok).toBe(false);
  });

  it("rejects a second account on the same mailbox (gmail dots / +tags)", async () => {
    m.userFindUnique.mockImplementation(async ({ where }: { where: { id: string } }) => ({ email: where.id === "u-ref" ? "jane.doe@gmail.com" : "janedoe+x@gmail.com" }));
    const res = await attachReferral(params);
    expect(res.ok).toBe(false);
    expect(m.referralCreate).not.toHaveBeenCalled();
  });

  it("rejects when a code was already applied", async () => {
    m.referralFindUnique.mockResolvedValue({ id: "r0" });
    expect((await attachReferral(params)).ok).toBe(false);
  });

  it("rejects customers who already ordered", async () => {
    m.orderCount.mockResolvedValue(1);
    expect((await attachReferral(params)).ok).toBe(false);
  });

  it("reports a lost race (unique violation) as already applied", async () => {
    const { Prisma } = await import("@prisma/client");
    m.referralCreate.mockRejectedValue(new (Prisma as any).PrismaClientKnownRequestError("dup", { code: "P2002" }));
    const res = await attachReferral(params);
    expect(res.ok).toBe(false);
  });
});

describe("helpers", () => {
  it("normalizes codes", () => expect(normalizeReferralCode("ab-cd 23")).toBe("ABCD23"));
  it("canonicalizes gmail aliases only", () => {
    expect(canonicalEmail("A.B+promo@Gmail.com")).toBe("ab@gmail.com");
    expect(canonicalEmail("a.b@company.com")).toBe("a.b@company.com");
  });
});
