/** Weekly payout reconciliation summary. Pure; lib/chores/run.ts loads the rows. */
export type PayoutRow = { status: "HELD" | "QUEUED" | "PROCESSING" | "PAID" | "FAILED" | "REVERSED"; amount: number; feeAmount: number; createdAt: Date };

export type PayoutDigest = {
  paidCount: number;
  paidTotal: number;
  feesTotal: number;
  /** Failed or reversed: money the merchant should know did NOT arrive. */
  problemCount: number;
  problemTotal: number;
  /** Still QUEUED/PROCESSING after the grace window. */
  stuckCount: number;
  stuckTotal: number;
};

export const STUCK_AFTER_HOURS = 48;

export function summarizePayouts(rows: PayoutRow[], now: Date): PayoutDigest {
  const d: PayoutDigest = { paidCount: 0, paidTotal: 0, feesTotal: 0, problemCount: 0, problemTotal: 0, stuckCount: 0, stuckTotal: 0 };
  for (const r of rows) {
    if (r.status === "PAID") { d.paidCount++; d.paidTotal += r.amount; d.feesTotal += r.feeAmount; }
    else if (r.status === "FAILED" || r.status === "REVERSED") { d.problemCount++; d.problemTotal += r.amount; }
    else if (now.getTime() - r.createdAt.getTime() >= STUCK_AFTER_HOURS * 3_600_000) { d.stuckCount++; d.stuckTotal += r.amount; }
  }
  return d;
}

export const digestHasActivity = (d: PayoutDigest) => d.paidCount + d.problemCount + d.stuckCount > 0;
