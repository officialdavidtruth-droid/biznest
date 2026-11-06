import "server-only";
import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { settleAndPayout } from "@/lib/payments/payout";
import { amountCoversExpected } from "@/lib/payments/amount";
import { postPaymentToLedgerByReference } from "@/lib/financial/order-ledger";
import { notifyUser } from "@/lib/notifications/notify";
import { logError, logWarn } from "@/lib/observability/log";
import { formatMoney } from "@/lib/utils/format-money";
import { markMemberChargePaid } from "@/lib/payments/member-receipt";
import { sendMemberReceiptEmail } from "@/lib/payments/member-confirmation";
import { memberPortalPath, givingPath } from "@/lib/members";
import type { ActionResult } from "@/types/actions";

/**
 * Member settlement: dues, packages and gifts paid online.
 * Lives outside "use server" files on purpose: it takes caller-supplied amounts, so only the webhook, callback,
 * reconciliation and manual-transfer paths may import it.
 *
 * The charge is marked PAID with a receipt number exactly once per gateway reference. If it was already paid or
 * voided meanwhile (staff recorded cash first), nothing is applied and the payment is flagged for refund.
 * `redirectPath` is where the payer should land: their portal, or the public giving page for anonymous gifts.
 */
export async function settleMemberPayment(
  reference: string,
  provider: "PAYSTACK" | "FLUTTERWAVE" | "KORAPAY" | "CASH",
  verifiedAmount: number,
  rawPayload: object,
  verifiedCurrency?: string | null
): Promise<ActionResult<{ storeSlug: string; redirectPath: string }>> {
  const payment = await prisma.payment.findUnique({
    where: { reference },
    include: { memberCharge: { include: { member: true, store: { select: { id: true, slug: true, business: { select: { user: { select: { id: true } } } } } } } } },
  });
  if (!payment || payment.purpose !== "MEMBER_PAYMENT" || !payment.memberCharge) return { success: false, error: "Member payment not found." };
  const charge = payment.memberCharge;
  const slug = charge.store.slug;
  const redirectPath = charge.member?.portalToken ? memberPortalPath(slug, charge.member.portalToken) : givingPath(slug);
  const ok = { storeSlug: slug, redirectPath };
  if (payment.provider !== provider) return { success: false, error: "Payment provider mismatch." };
  if (payment.status === "SUCCESSFUL") return { success: true, data: ok };
  if (payment.status !== "PENDING" && payment.status !== "FAILED") return { success: false, error: "Member payment is not pending." };

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
    const receiptNo = await markMemberChargePaid(tx, { chargeId: charge.id, storeId: charge.storeId, method: provider === "CASH" ? "TRANSFER" : "CARD", reference, note: "Paid online" });
    applied = receiptNo !== null;
    if (!applied) {
      await tx.payment.update({ where: { id: payment.id }, data: { rawPayload: { verification: rawPayload, overpaid: Number(payment.amount), note: "Charge was already paid or voided. Refund this payment." } as object } });
    }
  });

  if (settledNow && !applied) void logWarn("PAYMENTS", "Member payment arrived for a charge that was already settled. Refund it.", { reference, chargeId: charge.id });

  await postPaymentToLedgerByReference(reference);
  await settleAndPayout(reference);

  if (settledNow && applied) await Promise.allSettled([sendMemberReceiptEmail(reference)]);
  const ownerId = charge.store.business?.user?.id;
  if (settledNow && ownerId) {
    try {
      const who = charge.member?.name ?? charge.donorName ?? "Someone";
      await notifyUser({
        userId: ownerId, type: "MEMBER_PAYMENT",
        title: applied ? `Payment received: ${charge.label}` : `Refund needed: ${charge.label} paid twice`,
        body: applied ? `${who} paid ${formatMoney(Number(payment.amount), "NGN")} for ${charge.label}.` : `${formatMoney(Number(payment.amount), "NGN")} arrived for ${charge.label}, which was already settled. Refund it.`,
        url: `/store/${slug}/admin/members`,
      });
    } catch (err) {
      void logError("PAYMENTS", "Could not notify store of member payment", { reference, error: String(err) });
    }
  }

  revalidatePath(`/store/${slug}/admin/members`);
  revalidatePath(redirectPath);
  return { success: true, data: ok };
}
