import "server-only";
import { settleAndPayout } from "@/lib/payments/payout";
import { prisma } from "@/lib/prisma";
import { logWarn } from "@/lib/observability/log";
import { amountCoversExpected } from "@/lib/payments/amount";
import { postPaymentToLedgerByReference } from "@/lib/financial/order-ledger";
import { revalidatePath } from "next/cache";
import { SEAT_HOLDING_STATUSES } from "@/lib/travel";
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
  rawPayload: object
): Promise<ActionResult<{ storeSlug: string; tripId: string }>> {
  const payment = await prisma.payment.findUnique({ where: { reference }, include: { travelTrip: { include: { store: true, travellers: { select: { id: true } } } } } });
  if (!payment || payment.purpose !== "TRAVEL_BOOKING" || !payment.travelTrip) return { success: false, error: "Travel payment not found." };
  const trip = payment.travelTrip;
  if (payment.provider !== provider) return { success: false, error: "Payment provider mismatch." };
  if (payment.status === "SUCCESSFUL") return { success: true, data: { storeSlug: trip.store.slug, tripId: trip.id } };
  if (payment.status !== "PENDING" && payment.status !== "FAILED") return { success: false, error: "Travel payment is not pending." };
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
    }

    if ((trip.status === "ENQUIRY" || trip.status === "QUOTED") && Number(trip.totalPrice) > 0) {
      let hasSeats = true;
      if (trip.packageId) {
        const pkg = await tx.travelPackage.findUnique({ where: { id: trip.packageId }, select: { seats: true } });
        if (pkg && pkg.seats > 0) {
          const taken = await tx.travelTraveler.count({ where: { trip: { packageId: trip.packageId, id: { not: trip.id }, status: { in: [...SEAT_HOLDING_STATUSES] } } } });
          hasSeats = trip.travellers.length <= pkg.seats - taken;
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
