// Pure wallet maths for the vendor referral program (no database), so the money rules can be tested.

export type WalletGroup = {
  key: string;
  planName: string;
  reward: number;
  unlockCount: number;
  confirmed: number;
  /** Referrals still needed before the next withdrawal unlocks (0 when unlocked). */
  needed: number;
  withdrawableCount: number;
  withdrawableAmount: number;
  lockedAmount: number;
  ids: string[];
};

export type Wallet = {
  groups: WalletGroup[];
  withdrawable: number;
  locked: number;
  pending: number;
  withdrawn: number;
  inFlight: number;
};

export type WalletRow = { id: string; planId: string | null; planName: string | null; reward: unknown; unlockCount: number; status: string; withdrawalId: string | null; confirmedAt: Date | null };

export function buildWallet(rows: WalletRow[], withdrawals: { status: string; amount: unknown }[]): Wallet {
  const groups = new Map<string, WalletGroup & { rewards: { id: string; amount: number }[] }>();
  let pending = 0;
  for (const r of rows) {
    if (r.status === "PENDING") pending += Number(r.reward);
    if (r.status !== "CONFIRMED" || r.withdrawalId) continue;
    const unlock = Math.max(1, r.unlockCount || 1);
    const key = `${r.planId ?? "plan"}:${unlock}`;
    let g = groups.get(key);
    if (!g) {
      g = { key, planName: r.planName ?? "Plan", reward: Number(r.reward), unlockCount: unlock, confirmed: 0, needed: unlock, withdrawableCount: 0, withdrawableAmount: 0, lockedAmount: 0, ids: [], rewards: [] };
      groups.set(key, g);
    }
    g.rewards.push({ id: r.id, amount: Number(r.reward) });
  }
  const list: WalletGroup[] = [];
  for (const g of groups.values()) {
    const n = g.rewards.length;
    const usable = Math.floor(n / g.unlockCount) * g.unlockCount;
    g.confirmed = n;
    g.withdrawableCount = usable;
    g.ids = g.rewards.slice(0, usable).map((x) => x.id);
    g.withdrawableAmount = g.rewards.slice(0, usable).reduce((a, x) => a + x.amount, 0);
    g.lockedAmount = g.rewards.slice(usable).reduce((a, x) => a + x.amount, 0);
    g.needed = n % g.unlockCount === 0 ? g.unlockCount : g.unlockCount - (n % g.unlockCount);
    if (usable > 0 && n % g.unlockCount === 0) g.needed = g.unlockCount;
    const { rewards: _drop, ...clean } = g;
    void _drop;
    list.push(clean);
  }
  const sum = (st: string[]) => withdrawals.filter((w) => st.includes(w.status)).reduce((a, w) => a + Number(w.amount), 0);
  return {
    groups: list,
    withdrawable: list.reduce((a, g) => a + g.withdrawableAmount, 0),
    locked: list.reduce((a, g) => a + g.lockedAmount, 0),
    pending,
    withdrawn: sum(["PAID"]),
    inFlight: sum(["REVIEW", "QUEUED", "PROCESSING"]),
  };
}

