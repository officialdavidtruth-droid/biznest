import "server-only";
import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { settleAndPayout } from "@/lib/payments/payout";
import { amountCoversExpected } from "@/lib/payments/amount";
import { postPaymentToLedgerByReference } from "@/lib/financial/order-ledger";
import { notifyUser } from "@/lib/notifications/notify";
import { logError, logWarn } from "@/lib/observability/log";
import { formatMoney } from "@/lib/utils/format-money";
import type { ActionResult } from "@/types/actions";

/**
 * Tailoring balance settlement (a customer paying toward a job from their status page).
 * Lives outside "use server" files on purpose: it takes caller-supplied amounts, so it must only be imported by the
 * webhook, callback, reconciliation and manual-transfer code paths.
 *
 * On success the money is added to the job's amountPaid exactly once per gateway reference. If the balance was
 * already cleared in the meantime (e.g. the tailor recorded a cash payment), only what fits is credited and the
 * surplus is written onto the payment so the store can refund it.
 */
export async function settleTailoringPayment(
  reference: string,
  provider: "PAYSTACK" | "FLUTTERWAVE" | "KORAPAY" | "CASH",
  verifiedAmount: number,
  rawPayload: object,
  /** Currency the gateway reports it collected. Must match the payment's currency (not checked for bank transfers). */
  verifiedCurrency?: string | null
): Promise<ActionResult<{ storeSlug: string; jobId: string; trackingToken: string }>> {
  const payment = await prisma.payment.findUnique({
    where: { reference },
    include: { tailoringJob: { include: { store: { select: { id: true, slug: true, currency: true, business: { select: { user: { select: { id: true } } } } } } } } },
  });
  if (!payment || payment.purpose !== "TAILORING_BALANCE" || !payment.tailoringJob) return { success: false, error: "Tailoring payment not found." };
  const job = payment.tailoringJob;
  const ok = { storeSlug: job.store.slug, jobId: job.id, trackingToken: job.trackingToken };
  if (payment.provider !== provider) return { success: false, error: "Payment provider mismatch." };
  if (payment.status === "SUCCESSFUL") return { success: true, data: ok };
  if (payment.status !== "PENDING" && payment.status !== "FAILED") return { success: false, error: "Tailoring payment is not pending." };

  if (provider !== "CASH") {
    const expectedCurrency = String(payment.currency ?? "NGN").toUpperCase();
    if (verifiedCurrency ? verifiedCurrency.toUpperCase() !== expectedCurrency : expectedCurrency !== "NGN") return { success: false, error: "Payment currency mismatch." };
  }
  if (!amountCoversExpected(Number(verifiedAmount), Number(payment.amount))) return { success: false, error: "Payment amount mismatch." };

  const amount = Number(payment.amount);
  let settledNow = false;
  let surplus = 0;
  await prisma.$transaction(async (tx) => {
    const claim = await tx.payment.updateMany({ where: { id: payment.id, status: { in: ["PENDING", "FAILED"] } }, data: { status: "SUCCESSFUL", rawPayload, verifiedAt: new Date() } });
    if (claim.count === 0) return; // another request settled it first
    settledNow = true;

    const before = await tx.tailoringJob.findUniqueOrThrow({ where: { id: job.id }, select: { amountPaid: true } });
    // One atomic statement: never credit past the price, even if two payments settle at the same moment.
    await tx.$executeRaw`UPDATE "TailoringJob" SET "amountPaid" = LEAST(COALESCE("price", "amountPaid" + ${amount}::numeric), "amountPaid" + ${amount}::numeric), "updatedAt" = NOW() WHERE "id" = ${job.id}`;
    const after = await tx.tailoringJob.findUniqueOrThrow({ where: { id: job.id }, select: { amountPaid: true } });
    surplus = Math.round((amount - (Number(after.amountPaid) - Number(before.amountPaid))) * 100) / 100;
    if (surplus > 0.009) {
      await tx.payment.update({ where: { id: payment.id }, data: { rawPayload: { verification: rawPayload, overpaid: surplus, note: "Balance was already cleared. Refund the surplus." } as object } });
    }
  });

  if (surplus > 0.009) void logWarn("PAYMENTS", "Tailoring payment exceeded the remaining balance. Refund the surplus.", { reference, jobId: job.id, surplus });

  await postPaymentToLedgerByReference(reference);
  await settleAndPayout(reference);

  // Tell the store once, from the call that actually settled the payment. Awaited: un-awaited work is dropped when the invocation returns.
  const ownerId = job.store.business?.user?.id;
  if (settledNow && ownerId) {
    try {
      await notifyUser({
        userId: ownerId, type: "TAILORING_PAYMENT",
        title: `${job.customerName} paid toward ${job.jobNo}`,
        body: `${formatMoney(amount, payment.currency)} received for ${job.garmentType}.${surplus > 0.009 ? ` ${formatMoney(surplus, payment.currency)} was more than the balance owed: refund it.` : ""}`,
        url: `/store/${job.store.slug}/admin/fashion`,
      });
    } catch (err) {
      void logError("PAYMENTS", "Could not notify store of tailoring payment", { reference, error: String(err) });
    }
  }

  revalidatePath(`/store/${job.store.slug}/admin/fashion`);
  revalidatePath(`/store/${job.store.slug}/tailoring/${job.trackingToken}`);
  return { success: true, data: ok };
}
