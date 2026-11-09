import { describe, expect, it } from "vitest";
import { buildWallet, type WalletRow } from "@/lib/referrals/wallet";

const row = (i: number, over: Partial<WalletRow> = {}): WalletRow => ({
  id: `r${i}`, planId: "starters", planName: "Starters", reward: 2000, unlockCount: 5, status: "CONFIRMED", withdrawalId: null, confirmedAt: new Date(2026, 0, i + 1), ...over,
});

describe("vendor referral wallet", () => {
  it("stays locked until the plan's referral count is reached", () => {
    const w = buildWallet([row(1), row(2), row(3), row(4)], []);
    expect(w.withdrawable).toBe(0);
    expect(w.locked).toBe(8000);
    expect(w.groups[0].needed).toBe(1);
  });

  it("unlocks exactly at 5 Starters referrals = ₦10,000", () => {
    const w = buildWallet([1, 2, 3, 4, 5].map((i) => row(i)), []);
    expect(w.withdrawable).toBe(10000);
    expect(w.groups[0].ids).toHaveLength(5);
  });

  it("with 7 referrals only the first 5 unlock and 2 carry over", () => {
    const w = buildWallet([1, 2, 3, 4, 5, 6, 7].map((i) => row(i)), []);
    expect(w.withdrawable).toBe(10000);
    expect(w.locked).toBe(4000);
    expect(w.groups[0].needed).toBe(3);
  });

  it("counts each plan on its own: 3 Starters + 1 Mogul unlocks nothing", () => {
    const rows = [row(1), row(2), row(3), row(4, { planId: "mogul", planName: "Business Mogul", reward: 10000, unlockCount: 3 })];
    expect(buildWallet(rows, []).withdrawable).toBe(0);
  });

  it("Entrepreneurship unlocks after 2, Mogul after 3", () => {
    const ent = [1, 2].map((i) => row(i, { planId: "ent", planName: "Entrepreneurship", reward: 5000, unlockCount: 2 }));
    const mog = [1, 2, 3].map((i) => row(i + 10, { planId: "mogul", planName: "Business Mogul", reward: 10000, unlockCount: 3 }));
    expect(buildWallet(ent, []).withdrawable).toBe(10000);
    expect(buildWallet(mog, []).withdrawable).toBe(30000);
  });

  it("ignores pending, cancelled and already-withdrawn rewards", () => {
    const rows = [row(1, { status: "PENDING" }), row(2, { status: "CANCELLED" }), row(3, { withdrawalId: "w1" }), row(4), row(5), row(6), row(7), row(8)];
    const w = buildWallet(rows, [{ status: "PAID", amount: 2000 }]);
    expect(w.pending).toBe(2000);
    expect(w.withdrawable).toBe(10000);
    expect(w.withdrawn).toBe(2000);
  });
});
