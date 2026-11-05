import "server-only";
import { settleAndPayout } from "@/lib/payments/payout";
import { prisma } from "@/lib/prisma";
import { logWarn } from "@/lib/observability/log";
import { amountCoversExpected } from "@/lib/payments/amount";
import { postPaymentToLedgerByReference } from "@/lib/financial/order-ledger";
import { revalidatePath } from "next/cache";
import { seatCapacity, seatsHeld } from "@/lib/travel-seats";
import { allocateAgainstDue } from "@/lib/travel-growth";
import { sendTravelPaymentEmail, notifyAgencyOfTravelPayment } from "@/lib/payments/travel-confirmation";
import type { ActionResult } from "@/types/actions";

/**
 * BizNest Travel payment settlement (deposit or balance for a trip).
 * Lives outside "use server" files on purpose: it takes caller-supplied amounts, so it must only be
 * imported by the webhook, callback, reconciliation and manual-transfer code paths.
 *
 * On success it records the money on the trip (a TravelPayment, once per gateway reference) and, when a
 * paid enquiry/quote still has its seats, confirms the trip. If the tour sold out in the meantime the trip
 * stays an enquiry and the payment is flagged so the agency can refund or move the traveller.
 */
export async function settleTravelPayment(
  reference: string,
  provider: "PAYSTACK" | "FLUTTERWAVE" | "KORAPAY" | "CASH",
  verifiedAmountNaira: number,
  rawPayload: object,
  /** Currency the gateway reports it collected. Must match the payment's currency; required for anything but NGN. */
  verifiedCurrency?: string | null
): Promise<ActionResult<{ storeSlug: string; tripId: string }>> {
  const payment = await prisma.payment.findUnique({ where: { reference }, include: { travelTrip: { include: { store: true, travellers: { select: { id: true } } } } } });
  if (!payment || payment.purpose !== "TRAVEL_BOOKING" || !payment.travelTrip) return { success: false, error: "Travel payment not found." };
  const trip = payment.travelTrip;
  if (payment.provider !== provider) return { success: false, error: "Payment provider mismatch." };
  if (payment.status === "SUCCESSFUL") return { success: true, data: { storeSlug: trip.store.slug, tripId: trip.id } };
  if (payment.status !== "PENDING" && payment.status !== "FAILED") return { success: false, error: "Travel payment is not pending." };
  const expectedCurrency = String(payment.currency ?? "NGN").toUpperCase();
  if (verifiedCurrency ? verifiedCurrency.toUpperCase() !== expectedCurrency : expectedCurrency !== "NGN") return { success: false, error: "Payment currency mismatch." };
  if (!amountCoversExpected(Number(verifiedAmountNaira), Number(payment.amount))) return { success: false, error: "Payment amount mismatch." };

  let soldOut = false;
  let settledNow = false;
  await prisma.$transaction(async (tx) => {
    const result = await tx.payment.updateMany({ where: { id: payment.id, status: { in: ["PENDING", "FAILED"] } }, data: { status: "SUCCESSFUL", rawPayload, verifiedAt: new Date() } });
    if (result.count === 0) return; // another request settled it first
    settledNow = true;

    const already = await tx.travelPayment.findFirst({ where: { tripId: trip.id, reference } });
    if (!already) {
      await tx.travelPayment.create({ data: { tripId: trip.id, amount: payment.amount, method: provider === "CASH" ? "TRANSFER" : "CARD", status: "RECEIVED", paidAt: new Date(), reference, note: "Paid online" } });
      // Money that arrives online pays off the oldest scheduled instalments, so they stop showing as due/overdue.
      const dues = await tx.travelPayment.findMany({ where: { tripId: trip.id, status: "DUE" }, select: { id: true, amount: true, dueDate: true } });
      for (const m of allocateAgainstDue(dues.map((d) => ({ id: d.id, amount: Number(d.amount), dueDate: d.dueDate })), Number(payment.amount))) {
        if (m.action === "settle") await tx.travelPayment.update({ where: { id: m.id }, data: { status: "VOID", note: `Paid online (${reference})` } });
        else await tx.travelPayment.update({ where: { id: m.id }, data: { amount: m.newAmount } });
      }
    }

    if ((trip.status === "ENQUIRY" || trip.status === "QUOTED") && Number(trip.totalPrice) > 0) {
      let hasSeats = true;
      if (trip.packageId) {
        const pool = await seatCapacity(tx, trip.packageId, trip.departureId);
        if (pool && pool.capacity > 0) {
          const taken = await seatsHeld(tx, trip.packageId, trip.departureId, trip.id);
          hasSeats = trip.travellers.length <= pool.capacity - taken;
        }
      }
      if (hasSeats) await tx.travelTrip.update({ where: { id: trip.id }, data: { status: "CONFIRMED" } });
      else soldOut = true;
    }
  });

  if (soldOut) void logWarn("PAYMENTS", "Travel deposit paid but the tour no longer has enough seats. Refund or move the travellers.", { reference, tripId: trip.id });
  if (trip.status === "CANCELLED") void logWarn("PAYMENTS", "Travel payment received for a cancelled trip. Refund may be needed.", { reference, tripId: trip.id });

  await postPaymentToLedgerByReference(reference);
  await settleAndPayout(reference);

  // Receipt email goes out once, from the call that actually settled the payment (not webhook replays).
  // Awaited (allSettled never throws): un-awaited sends are dropped when the serverless invocation returns.
  if (settledNow) await Promise.allSettled([sendTravelPaymentEmail(reference), notifyAgencyOfTravelPayment(reference)]);

  revalidatePath(`/store/${trip.store.slug}/admin/travel`);
  return { success: true, data: { storeSlug: trip.store.slug, tripId: trip.id } };
}
