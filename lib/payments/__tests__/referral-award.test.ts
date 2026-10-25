import { beforeEach, describe, expect, it, vi } from "vitest";

const m = vi.hoisted(() => {
  const tx = {
    referral: { updateMany: vi.fn() },
    storeLoyaltyAccount: { upsert: vi.fn(), update: vi.fn() },
    storeLoyaltyEntry: { create: vi.fn() },
  };
  return {
    tx,
    orderFindUnique: vi.fn(),
    orderCount: vi.fn(),
    referralFindUnique: vi.fn(),
    transaction: vi.fn(async (fn: (t: typeof tx) => unknown) => fn(tx)),
  };
});

vi.mock("@/lib/prisma", () => ({
  prisma: {
    order: { findUnique: m.orderFindUnique, count: m.orderCount },
    referral: { findUnique: m.referralFindUnique },
    $transaction: m.transaction,
  },
}));

import { awardReferralRewardForOrder } from "@/lib/payments/referral-award";

const referral = (over: Record<string, unknown> = {}) => ({
  id: "r1", referrerId: "u-ref", refereeId: "u-new", status: "PENDING",
  store: { referralEnabled: true, referralReferrerPoints: 500, referralRefereePoints: 200 },
  ...over,
});

beforeEach(() => {
  vi.clearAllMocks();
  m.transaction.mockImplementation(async (fn: (t: typeof m.tx) => unknown) => fn(m.tx));
  m.orderFindUnique.mockResolvedValue({ id: "o1", storeId: "s1", buyerId: "u-new", status: "COMPLETED" });
  m.orderCount.mockResolvedValue(0);
  m.referralFindUnique.mockResolvedValue(referral());
  m.tx.referral.updateMany.mockResolvedValue({ count: 1 });
  m.tx.storeLoyaltyAccount.upsert.mockImplementation(async ({ create }: { create: { userId: string } }) => ({ id: `acct-${create.userId}` }));
});

describe("awardReferralRewardForOrder", () => {
  it("pays both sides on the referred customer's first completed order", async () => {
    await awardReferralRewardForOrder("o1");

    expect(m.tx.referral.updateMany).toHaveBeenCalledWith({
      where: { id: "r1", status: "PENDING" },
      data: expect.objectContaining({ status: "REWARDED", qualifyingOrderId: "o1", referrerPoints: 500, refereePoints: 200 }),
    });
    const credits = m.tx.storeLoyaltyEntry.create.mock.calls.map((c) => c[0].data);
    expect(credits).toEqual([
      expect.objectContaining({ loyaltyAccountId: "acct-u-ref", type: "ADJUSTMENT", points: 500 }),
      expect.objectContaining({ loyaltyAccountId: "acct-u-new", type: "ADJUSTMENT", points: 200 }),
    ]);
  });

  it("pays nothing when the status-guarded claim loses (replay / concurrent completion)", async () => {
    m.tx.referral.updateMany.mockResolvedValue({ count: 0 });
    await awardReferralRewardForOrder("o1");
    expect(m.tx.storeLoyaltyEntry.create).not.toHaveBeenCalled();
  });

  it("pays nothing if the customer already has an earlier completed order", async () => {
    m.orderCount.mockResolvedValue(1);
    await awardReferralRewardForOrder("o2");
    expect(m.transaction).not.toHaveBeenCalled();
  });

  it("pays nothing when the program has been switched off or the referral is already settled", async () => {
    m.referralFindUnique.mockResolvedValue(referral({ store: { referralEnabled: false, referralReferrerPoints: 500, referralRefereePoints: 200 } }));
    await awardReferralRewardForOrder("o1");
    m.referralFindUnique.mockResolvedValue(referral({ status: "REWARDED" }));
    await awardReferralRewardForOrder("o1");
    expect(m.transaction).not.toHaveBeenCalled();
  });

  it("does nothing for buyers who were never referred", async () => {
    m.referralFindUnique.mockResolvedValue(null);
    await awardReferralRewardForOrder("o1");
    expect(m.transaction).not.toHaveBeenCalled();
  });

  it("skips a zero-point side but still pays the other", async () => {
    m.referralFindUnique.mockResolvedValue(referral({ store: { referralEnabled: true, referralReferrerPoints: 500, referralRefereePoints: 0 } }));
    await awardReferralRewardForOrder("o1");
    expect(m.tx.storeLoyaltyEntry.create).toHaveBeenCalledTimes(1);
  });
});
