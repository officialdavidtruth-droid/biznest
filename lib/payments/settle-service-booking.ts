import "server-only";
import { settleAndPayout } from "@/lib/payments/payout";

import { prisma } from "@/lib/prisma";
import { confirmPaidBooking } from "@/lib/payments/booking-confirmation";
import type { ActionResult } from "@/types/actions";
import { revalidatePath } from "next/cache";

/**
 * Service booking payment settlement.
 * Lives outside "use server" files on purpose: a "use server" export is a public
 * endpoint, and this takes caller-supplied amounts/payloads. Import it only from
 * the webhook and callback route handlers.
 */

export async function settleServiceBookingPayment(
  reference: string,
  provider: "PAYSTACK" | "FLUTTERWAVE",
  verifiedAmountNaira: number,
  rawPayload: object
): Promise<ActionResult<{ storeSlug: string; bookingId: string }>> {
  const payment = await prisma.payment.findUnique({ where: { reference }, include: { booking: { include: { service: true, store: true } } } });
  if (!payment || payment.purpose !== "SERVICE_BOOKING" || !payment.booking) return { success: false, error: "Booking payment not found." };
  if (payment.provider !== provider) return { success: false, error: "Payment provider mismatch." };
  if (payment.status === "SUCCESSFUL") return { success: true, data: { storeSlug: payment.booking.store.slug, bookingId: payment.booking.id } };
  if (payment.status !== "PENDING") return { success: false, error: "Booking payment is not pending." };
  if (Math.abs(Number(payment.amount) - Number(verifiedAmountNaira)) > 0.01) return { success: false, error: "Payment amount mismatch." };

  await prisma.$transaction(async (tx) => {
    const result = await tx.payment.updateMany({ where: { id: payment.id, status: "PENDING" }, data: { status: "SUCCESSFUL", rawPayload, verifiedAt: new Date() } });
    if (result.count === 0) return;
    await tx.booking.updateMany({
      where: {
        id: payment.booking!.id,
        paymentStatus: { not: "PAID" },
        status: { not: "CANCELLED" },
      },
      data: {
        paymentStatus: "PAID",
        paymentReference: reference,
        paymentAmount: payment.amount,
        paymentCurrency: payment.currency,
      },
    });
  }, { isolationLevel: "Serializable" });

  await settleAndPayout(reference);
  void confirmPaidBooking(payment.booking.id, reference, Number(payment.amount));

  revalidatePath(`/store/${payment.booking.store.slug}`);
  revalidatePath(`/store/${payment.booking.store.slug}/account/bookings`);
  return { success: true, data: { storeSlug: payment.booking.store.slug, bookingId: payment.booking.id } };
}
