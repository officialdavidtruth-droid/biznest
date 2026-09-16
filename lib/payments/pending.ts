import { prisma } from "@/lib/prisma";
import type { PaymentProvider, Prisma } from "@prisma/client";

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
  walletId?: string;
  splitSubaccountCode?: string | null;
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
      walletId: input.walletId,
      splitSubaccountCode: input.splitSubaccountCode,
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
  await prisma.payment.updateMany({ where: { reference, status: "PENDING" }, data: { status: "FAILED" } });
}
