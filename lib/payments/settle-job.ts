import "server-only";
import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { settleAndPayout } from "@/lib/payments/payout";
import { amountCoversExpected } from "@/lib/payments/amount";
import { postPaymentToLedgerByReference } from "@/lib/financial/order-ledger";
import { notifyUser } from "@/lib/notifications/notify";
import { logError, logWarn } from "@/lib/observability/log";
import { formatMoney } from "@/lib/utils/format-money";
import { markJobChargePaid } from "@/lib/payments/job-receipt";
import { sendJobReceiptEmail } from "@/lib/payments/job-confirmation";
import { jobPagePath } from "@/lib/jobs";
import type { ActionResult } from "@/types/actions";

/**
 * Job-card settlement (a customer paying a deposit, balance or other charge from their job link).
 * Lives outside "use server" files on purpose: it takes caller-supplied amounts, so only the webhook, callback,
 * reconciliation and manual-transfer paths may import it. The charge is marked PAID with a receipt number exactly
 * once per gateway reference; if it was already paid or voided meanwhile the payment is flagged for refund.
 */
export async function settleJobPayment(
  reference: string,
  provider: "PAYSTACK" | "FLUTTERWAVE" | "KORAPAY" | "CASH",
  verifiedAmount: number,
  rawPayload: object,
  verifiedCurrency?: string | null
): Promise<ActionResult<{ storeSlug: string; redirectPath: string }>> {
  const payment = await prisma.payment.findUnique({
    where: { reference },
    include: { jobCharge: { include: { job: true, store: { select: { id: true, slug: true, business: { select: { user: { select: { id: true } } } } } } } } },
  });
  if (!payment || payment.purpose !== "JOB_PAYMENT" || !payment.jobCharge) return { success: false, error: "Job payment not found." };
  const charge = payment.jobCharge;
  const slug = charge.store.slug;
  const redirectPath = jobPagePath(slug, charge.job.accessToken);
  const ok = { storeSlug: slug, redirectPath };
  if (payment.provider !== provider) return { success: false, error: "Payment provider mismatch." };
  if (payment.status === "SUCCESSFUL") return { success: true, data: ok };
  if (payment.status !== "PENDING" && payment.status !== "FAILED") return { success: false, error: "Job payment is not pending." };

  if (provider !== "CASH") {
    const cur = verifiedCurrency ? verifiedCurrency.toUpperCase() : "NGN";
    if (cur !== "NGN") return { success: false, error: "Payment currency mismatch." };
  }
  if (!amountCoversExpected(Number(verifiedAmount), Number(payment.amount))) return { success: false, error: "Payment amount mismatch." };

  let settledNow = false;
  let applied = false;
  await prisma.$transaction(async (tx) => {
    const claim = await tx.payment.updateMany({ where: { id: payment.id, status: { in: ["PENDING", "FAILED"] } }, data: { status: "SUCCESSFUL", rawPayload, verifiedAt: new Date() } });
    if (claim.count === 0) return;
    settledNow = true;
    const receiptNo = await markJobChargePaid(tx, { chargeId: charge.id, storeId: charge.storeId, method: provider === "CASH" ? "TRANSFER" : "CARD", reference, note: "Paid online" });
    applied = receiptNo !== null;
    if (!applied) {
      await tx.payment.update({ where: { id: payment.id }, data: { rawPayload: { verification: rawPayload, overpaid: Number(payment.amount), note: "Charge was already paid or voided. Refund this payment." } as object } });
    }
  });

  if (settledNow && !applied) void logWarn("PAYMENTS", "Job payment arrived for a charge that was already settled. Refund it.", { reference, chargeId: charge.id });

  await postPaymentToLedgerByReference(reference);
  await settleAndPayout(reference);

  if (settledNow && applied) await Promise.allSettled([sendJobReceiptEmail(reference)]);
  const ownerId = charge.store.business?.user?.id;
  if (settledNow && ownerId) {
    try {
      await notifyUser({
        userId: ownerId, type: "JOB_PAYMENT",
        title: applied ? `Payment received: ${charge.job.jobNo}` : `Refund needed: ${charge.job.jobNo} paid twice`,
        body: applied ? `${charge.job.customerName} paid ${formatMoney(Number(payment.amount), "NGN")} (${charge.label}).` : `${formatMoney(Number(payment.amount), "NGN")} arrived for ${charge.label}, which was already settled. Refund it.`,
        url: `/store/${slug}/admin/jobs`,
      });
    } catch (err) {
      void logError("PAYMENTS", "Could not notify store of job payment", { reference, error: String(err) });
    }
  }
  revalidatePath(`/store/${slug}/admin/jobs`);
  revalidatePath(redirectPath);
  return { success: true, data: ok };
}
