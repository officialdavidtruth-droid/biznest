import { beforeEach, describe, expect, it, vi } from "vitest";

const m = vi.hoisted(() => {
  const tx = {
    referral: { updateMany: vi.fn(), count: vi.fn(), update: vi.fn() },
    storeLoyaltyAccount: { upsert: vi.fn(), update: vi.fn(), findUnique: vi.fn() },
    storeLoyaltyEntry: { create: vi.fn() },
  };
  return {
    tx,
    orderFindUnique: vi.fn(),
    orderCount: vi.fn(),
    referralFindUnique: vi.fn(),
    referralUpdateMany: vi.fn(),
    transaction: vi.fn(async (fn: (t: typeof tx) => unknown) => fn(tx)),
  };
});

vi.mock("@/lib/prisma", () => ({
  prisma: {
    order: { findUnique: m.orderFindUnique, count: m.orderCount },
    referral: { findUnique: m.referralFindUnique, updateMany: m.referralUpdateMany },
    $transaction: m.transaction,
  },
}));

vi.mock("@/lib/observability/log", () => ({ logError: vi.fn(), errorMeta: vi.fn() }));

import { awardReferralRewardForOrder, reverseReferralForOrder } from "@/lib/payments/referral-award";

const store = (over: Record<string, unknown> = {}) => ({
  referralEnabled: true, referralReferrerPoints: 500, referralRefereePoints: 200,
  referralMinOrderAmount: 0, referralMaxRewardsPerReferrer: 20, referralExpiryDays: 0, ...over,
});

const referral = (over: Record<string, unknown> = {}) => ({
  id: "r1", referrerId: "u-ref", refereeId: "u-new", status: "PENDING", createdAt: new Date(),
  promisedReferrerPoints: null, promisedRefereePoints: null,
  referee: { emailVerified: new Date() },
  store: { ...store(), },
  ...over,
});

beforeEach(() => {
  vi.clearAllMocks();
  m.transaction.mockImplementation(async (fn: (t: typeof m.tx) => unknown) => fn(m.tx));
  m.orderFindUnique.mockResolvedValue({ id: "o1", storeId: "s1", buyerId: "u-new", status: "COMPLETED", subtotal: 5000 });
  m.orderCount.mockResolvedValue(0);
  m.referralFindUnique.mockResolvedValue(referral());
  m.tx.referral.updateMany.mockResolvedValue({ count: 1 });
  m.tx.referral.count.mockResolvedValue(1);
  m.referralUpdateMany.mockResolvedValue({ count: 1 });
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
      expect.objectContaining({ loyaltyAccountId: "acct-u-ref", type: "ADJUSTMENT", points: 500, referralId: "r1", orderId: "o1" }),
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
    m.referralFindUnique.mockResolvedValue(referral({ store: store({ referralEnabled: false }) }));
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
    m.referralFindUnique.mockResolvedValue(referral({ store: store({ referralRefereePoints: 0 }) }));
    await awardReferralRewardForOrder("o1");
    expect(m.tx.storeLoyaltyEntry.create).toHaveBeenCalledTimes(1);
  });

  it("pays nothing for an order that isn't COMPLETED", async () => {
    m.orderFindUnique.mockResolvedValue({ id: "o1", storeId: "s1", buyerId: "u-new", status: "PAID", subtotal: 5000 });
    expect(await awardReferralRewardForOrder("o1")).toBe("SKIPPED");
    expect(m.transaction).not.toHaveBeenCalled();
  });

  it("pays nothing below the store's minimum order value", async () => {
    m.referralFindUnique.mockResolvedValue(referral({ store: store({ referralMinOrderAmount: 10000 }) }));
    expect(await awardReferralRewardForOrder("o1")).toBe("SKIPPED");
    expect(m.transaction).not.toHaveBeenCalled();
  });

  it("holds the reward until the friend's email is verified", async () => {
    m.referralFindUnique.mockResolvedValue(referral({ referee: { emailVerified: null } }));
    expect(await awardReferralRewardForOrder("o1")).toBe("HELD");
    expect(m.transaction).not.toHaveBeenCalled();
    expect(m.referralUpdateMany).toHaveBeenCalled();
  });

  it("holds (and rolls back) when the referrer is over the reward cap", async () => {
    m.referralFindUnique.mockResolvedValue(referral({ store: store({ referralMaxRewardsPerReferrer: 2 }) }));
    m.tx.referral.count.mockResolvedValue(3);
    expect(await awardReferralRewardForOrder("o1")).toBe("HELD");
    expect(m.tx.storeLoyaltyEntry.create).not.toHaveBeenCalled();
  });

  it("pays the points promised at signup even if the store later lowered them", async () => {
    m.referralFindUnique.mockResolvedValue(referral({ promisedReferrerPoints: 900, promisedRefereePoints: 100, store: store({ referralReferrerPoints: 10, referralRefereePoints: 10 }) }));
    await awardReferralRewardForOrder("o1");
    const credits = m.tx.storeLoyaltyEntry.create.mock.calls.map((c) => c[0].data.points);
    expect(credits).toEqual([900, 100]);
  });

  it("keeps the referral pending (HELD) while the program is paused", async () => {
    m.referralFindUnique.mockResolvedValue(referral({ store: store({ referralEnabled: false }) }));
    expect(await awardReferralRewardForOrder("o1")).toBe("HELD");
  });

  it("cancels a referral that expired before a qualifying order", async () => {
    m.referralFindUnique.mockResolvedValue(referral({ createdAt: new Date(Date.now() - 40 * 86_400_000), store: store({ referralExpiryDays: 30 }) }));
    expect(await awardReferralRewardForOrder("o1")).toBe("SKIPPED");
    expect(m.referralUpdateMany).toHaveBeenCalledWith(expect.objectContaining({ data: expect.objectContaining({ status: "CANCELLED" }) }));
  });
});

describe("reverseReferralForOrder", () => {
  const rewarded = { id: "r1", storeId: "s1", referrerId: "u-ref", refereeId: "u-new", referrerPoints: 500, refereePoints: 200, status: "REWARDED" };

  it("claws back what is still in each balance and marks the referral REVERSED", async () => {
    m.referralFindUnique.mockResolvedValue(rewarded);
    m.tx.referral.updateMany.mockResolvedValue({ count: 1 });
    m.tx.storeLoyaltyAccount.findUnique.mockImplementation(async ({ where }: { where: { storeId_userId: { userId: string } } }) =>
      where.storeId_userId.userId === "u-ref" ? { id: "a-ref", pointsBalance: 300 } : { id: "a-new", pointsBalance: 1000 });
    await reverseReferralForOrder("o1");
    const debits = m.tx.storeLoyaltyEntry.create.mock.calls.map((c) => c[0].data.points);
    expect(debits).toEqual([-300, -200]);
    expect(m.tx.referral.update).toHaveBeenCalled();
  });

  it("does nothing for a referral that wasn't rewarded", async () => {
    m.referralFindUnique.mockResolvedValue({ ...rewarded, status: "PENDING" });
    await reverseReferralForOrder("o1");
    expect(m.transaction).not.toHaveBeenCalled();
  });
});
