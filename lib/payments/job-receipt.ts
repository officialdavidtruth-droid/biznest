import "server-only";
import type { Prisma } from "@prisma/client";
import { receiptNumber, lastReceiptSeq } from "@/lib/jobs";

/**
 * Marks one DUE job charge as paid and gives it the store's next receipt number, in the caller's transaction.
 * Returns the receipt number, or null when the charge was not DUE (already paid or void), so nothing is double counted.
 * The (storeId, receiptNo) unique index makes two simultaneous settlements fail loudly instead of sharing a number;
 * the caller's transaction rolls back and the payment stays pending for reconciliation to retry.
 */
export async function markJobChargePaid(
  tx: Prisma.TransactionClient,
  input: { chargeId: string; storeId: string; method: string; reference?: string | null; note?: string | null; paidAt?: Date } // note is accepted for callers but JobCharge has no note column
): Promise<string | null> {
  const latest = await tx.jobCharge.findMany({ where: { storeId: input.storeId, receiptNo: { not: null } }, orderBy: { receiptNo: "desc" }, take: 1, select: { receiptNo: true } });
  const receiptNo = receiptNumber(lastReceiptSeq(latest.map((r) => r.receiptNo)) + 1);
  const res = await tx.jobCharge.updateMany({
    where: { id: input.chargeId, storeId: input.storeId, status: "DUE" },
    data: { status: "PAID", paidAt: input.paidAt ?? new Date(), method: input.method, reference: input.reference ?? null, receiptNo },
  });
  return res.count === 1 ? receiptNo : null;
}
