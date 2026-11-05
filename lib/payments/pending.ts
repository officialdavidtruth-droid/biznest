import { prisma } from "@/lib/prisma";
import { Prisma } from "@prisma/client";
import type { PaymentProvider } from "@prisma/client";

export async function createPendingPayment(input: {
  storeId: string;
  purpose: Prisma.PaymentCreateInput["purpose"];
  provider: PaymentProvider;
  reference: string;
  amount: number | Prisma.Decimal;
  currency: string;
  orderId?: string;
  bookingId?: string;
  reservationId?: string;
  travelTripId?: string;
  tailoringJobId?: string;
  rentChargeId?: string;
  walletId?: string;
  splitSubaccountCode?: string | null;
  /** Charged with the store's own gateway keys (see lib/payments/store-gateway.ts). */
  usesStoreGateway?: boolean;
}) {
  const existing = await prisma.payment.findUnique({ where: { reference: input.reference } });
  if (existing) {
    if (existing.storeId !== input.storeId) throw new Error("Payment reference belongs to another store.");
    return existing;
  }
  try {
    return await prisma.payment.create({
    data: {
      storeId: input.storeId,
      purpose: input.purpose,
      provider: input.provider,
      reference: input.reference,
      status: "PENDING",
      amount: input.amount,
      currency: input.currency,
      orderId: input.orderId,
      bookingId: input.bookingId,
      reservationId: input.reservationId,
      travelTripId: input.travelTripId,
      tailoringJobId: input.tailoringJobId,
      rentChargeId: input.rentChargeId,
      walletId: input.walletId,
      splitSubaccountCode: input.splitSubaccountCode,
      usesStoreGateway: input.usesStoreGateway ?? false,
    },
    });
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") {
      const raced = await prisma.payment.findUnique({ where: { reference: input.reference } });
      if (raced) {
        if (raced.storeId !== input.storeId) throw new Error("Payment reference belongs to another store.");
        return raced;
      }
    }
    throw error;
  }
}

export async function markPaymentFailed(reference: string) {
  const failed = await prisma.payment.updateMany({ where: { reference, status: "PENDING" }, data: { status: "FAILED" } });
  if (!failed.count) return;
  // A failed/abandoned PMS deposit must not leave the reservation stuck on
  // "payment in progress" — that state blocks cancelling, no-show and any new
  // deposit request until someone edits the database.
  const payment = await prisma.payment.findUnique({ where: { reference }, select: { reservationId: true } });
  if (payment?.reservationId) await reconcileReservationPaymentState(payment.reservationId);
}

/**
 * Puts a reservation's paymentStatus back to UNPAID when it says PENDING but
 * no payment for it is actually pending any more (the attempt failed, was
 * abandoned or its row was never created). Safe to call any time; returns the
 * resulting paymentStatus.
 */
export async function reconcileReservationPaymentState(reservationId: string) {
  const reservation = await prisma.propertyReservation.findUnique({ where: { id: reservationId }, select: { paymentStatus: true } });
  if (!reservation) return null;
  if (reservation.paymentStatus !== "PENDING") return reservation.paymentStatus;
  const stillPending = await prisma.payment.count({ where: { reservationId, purpose: "PMS_RESERVATION", status: "PENDING" } });
  if (stillPending > 0) return "PENDING" as const;
  await prisma.propertyReservation.updateMany({ where: { id: reservationId, paymentStatus: "PENDING" }, data: { paymentStatus: "UNPAID" } });
  return "UNPAID" as const;
}
