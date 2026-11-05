import "server-only";
import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { settleAndPayout } from "@/lib/payments/payout";
import { amountCoversExpected } from "@/lib/payments/amount";
import { postPaymentToLedgerByReference } from "@/lib/financial/order-ledger";
import { notifyUser } from "@/lib/notifications/notify";
import { logError, logWarn } from "@/lib/observability/log";
import { formatMoney } from "@/lib/utils/format-money";
import { markRentChargePaid } from "@/lib/payments/rent-receipt";
import { sendRentReceiptEmail } from "@/lib/payments/rent-confirmation";
import { rentPortalPath } from "@/lib/real-estate";
import type { ActionResult } from "@/types/actions";

/**
 * Rent settlement (a tenant paying one charge from their portal link).
 * Lives outside "use server" files on purpose: it takes caller-supplied amounts, so it must only be imported by the
 * webhook, callback, reconciliation and manual-transfer code paths.
 *
 * On success the charge is marked PAID with a receipt number, exactly once per gateway reference. If the charge was
 * already paid or voided in the meantime (e.g. the landlord recorded cash first) nothing is applied, and the payment is
 * flagged so the landlord can refund it.
 */
export async function settleRentPayment(
  reference: string,
  provider: "PAYSTACK" | "FLUTTERWAVE" | "KORAPAY" | "CASH",
  verifiedAmount: number,
  rawPayload: object,
  /** Currency the gateway reports it collected. Rent is always NGN (not checked for bank transfers). */
  verifiedCurrency?: string | null
): Promise<ActionResult<{ storeSlug: string; portalToken: string | null }>> {
  const payment = await prisma.payment.findUnique({
    where: { reference },
    include: { rentCharge: { include: { unit: { include: { property: { select: { name: true } } } }, store: { select: { id: true, slug: true, business: { select: { user: { select: { id: true } } } } } } } } },
  });
  if (!payment || payment.purpose !== "RENT_PAYMENT" || !payment.rentCharge) return { success: false, error: "Rent payment not found." };
  const charge = payment.rentCharge;
  const ok = { storeSlug: charge.store.slug, portalToken: charge.unit.portalToken };
  if (payment.provider !== provider) return { success: false, error: "Payment provider mismatch." };
  if (payment.status === "SUCCESSFUL") return { success: true, data: ok };
  if (payment.status !== "PENDING" && payment.status !== "FAILED") return { success: false, error: "Rent payment is not pending." };

  if (provider !== "CASH") {
    const cur = verifiedCurrency ? verifiedCurrency.toUpperCase() : "NGN";
    if (cur !== "NGN") return { success: false, error: "Payment currency mismatch." };
  }
  if (!amountCoversExpected(Number(verifiedAmount), Number(payment.amount))) return { success: false, error: "Payment amount mismatch." };

  let settledNow = false;
  let applied = false;
  let receiptNo: string | null = null;
  await prisma.$transaction(async (tx) => {
    const claim = await tx.payment.updateMany({ where: { id: payment.id, status: { in: ["PENDING", "FAILED"] } }, data: { status: "SUCCESSFUL", rawPayload, verifiedAt: new Date() } });
    if (claim.count === 0) return; // another request settled it first
    settledNow = true;
    receiptNo = await markRentChargePaid(tx, { chargeId: charge.id, storeId: charge.storeId, method: provider === "CASH" ? "TRANSFER" : "CARD", reference, note: "Paid online" });
    applied = receiptNo !== null;
    if (!applied) {
      await tx.payment.update({ where: { id: payment.id }, data: { rawPayload: { verification: rawPayload, overpaid: Number(payment.amount), note: "Charge was already paid or voided. Refund this payment." } as object } });
    }
  });

  if (settledNow && !applied) void logWarn("PAYMENTS", "Rent payment arrived for a charge that was already settled. Refund it.", { reference, chargeId: charge.id });

  await postPaymentToLedgerByReference(reference);
  await settleAndPayout(reference);

  // Receipt to the tenant and a bell to the landlord, once, from the call that actually settled the payment.
  // Awaited (allSettled never throws): un-awaited sends are dropped when the serverless invocation returns.
  if (settledNow && applied) await Promise.allSettled([sendRentReceiptEmail(reference)]);
  const ownerId = charge.store.business?.user?.id;
  if (settledNow && ownerId) {
    try {
      await notifyUser({
        userId: ownerId, type: "RENT_PAYMENT",
        title: applied ? `Rent received: ${charge.unit.property.name} ${charge.unit.unitNo}` : `Refund needed: rent paid twice for ${charge.unit.unitNo}`,
        body: applied
          ? `${charge.unit.tenantName ?? "Tenant"} paid ${formatMoney(Number(payment.amount), "NGN")} for ${charge.label}.`
          : `${formatMoney(Number(payment.amount), "NGN")} arrived for ${charge.label}, which was already settled. Refund it.`,
        url: `/store/${charge.store.slug}/admin/real-estate`,
      });
    } catch (err) {
      void logError("PAYMENTS", "Could not notify landlord of rent payment", { reference, error: String(err) });
    }
  }

  revalidatePath(`/store/${charge.store.slug}/admin/real-estate`);
  if (charge.unit.portalToken) revalidatePath(rentPortalPath(charge.store.slug, charge.unit.portalToken));
  return { success: true, data: ok };
}
