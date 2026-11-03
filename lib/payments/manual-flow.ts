import "server-only";
import crypto from "crypto";
import { prisma } from "@/lib/prisma";
import { buildStoreUrl } from "@/lib/store-url";
import { createPendingPayment } from "@/lib/payments/pending";
import { manualPayInfoFromStore, manualPayReady } from "@/lib/payments/manual-transfer";
import { resolveStoreGateway } from "@/lib/payments/store-gateway";
import { settleInvoicePayment } from "@/lib/payments/settle-invoice";
import { settleQuoteDeposit } from "@/lib/payments/settle-quote-deposit";
import { settleServiceBookingPayment } from "@/lib/payments/settle-service-booking";
import { settleReservationPayment } from "@/lib/payments/settle-reservation";
import { settleTravelPayment } from "@/lib/payments/settle-travel";
import { settleTailoringPayment } from "@/lib/payments/settle-tailoring";

/**
 * Bank transfer is how customers pay a store unless the owner has added their
 * OWN gateway keys. This module is the shared path for the payment purposes
 * that have no Order row (invoices, quote deposits, service bookings, PMS
 * deposits); order checkout has its own equivalent in lib/actions/order.ts.
 *
 * The Payment row is provider CASH ("settled outside the platform"), so the
 * existing settle* functions never queue a BizNest payout for it.
 */

export type PayRoute =
  | { mode: "gateway" } // the store's own Paystack/Flutterwave keys: use chargeCustomer
  | { mode: "manual" } // bank transfer into the vendor's own account
  | { mode: "error"; error: string };

/** Own keys win; otherwise bank transfer, provided the vendor has published a complete account. */
export async function resolvePayRoute(storeId: string): Promise<PayRoute> {
  const own = await resolveStoreGateway(storeId);
  if (own.status === "error") return { mode: "error", error: own.message };
  if (own.status === "ok") return { mode: "gateway" };
  const store = await prisma.store.findUnique({ where: { id: storeId } });
  if (!store || !manualPayReady(manualPayInfoFromStore(store))) {
    return { mode: "error", error: "This store hasn't finished setting up how to receive payments yet. Please contact the store." };
  }
  return { mode: "manual" };
}

export type ManualPurpose = "INVOICE" | "QUOTE_DEPOSIT" | "SERVICE_BOOKING" | "PMS_RESERVATION" | "TRAVEL_BOOKING" | "TAILORING_BALANCE";

const PREFIX: Record<ManualPurpose, string> = {
  INVOICE: "INV",
  QUOTE_DEPOSIT: "QDEP",
  SERVICE_BOOKING: "BK",
  PMS_RESERVATION: "RES",
  TRAVEL_BOOKING: "TVL",
  TAILORING_BALANCE: "TLR",
};

export const MANUAL_PURPOSE_LABEL: Record<ManualPurpose, string> = {
  INVOICE: "Invoice",
  QUOTE_DEPOSIT: "Quote deposit",
  SERVICE_BOOKING: "Booking",
  PMS_RESERVATION: "Reservation deposit",
  TRAVEL_BOOKING: "Tour booking",
  TAILORING_BALANCE: "Tailoring balance",
};

export function isManualPurpose(p: string): p is ManualPurpose {
  return p in PREFIX;
}

/**
 * Opens (or reuses) a pending bank-transfer payment for one invoice / quote /
 * booking / reservation and returns the pay page the customer should be sent to.
 * Reusing the open row means a customer who clicks "Pay" twice sees one payment, not two.
 */
export async function startManualTransfer(input: {
  store: { id: string; slug: string; customDomain: string | null; customDomainStatus: string };
  purpose: ManualPurpose;
  entityId: string;
  amount: number;
  currency: string;
  bookingId?: string;
  reservationId?: string;
  travelTripId?: string;
  tailoringJobId?: string;
}): Promise<{ reference: string; payUrl: string }> {
  const prefix = `${PREFIX[input.purpose]}-${input.entityId}-`;
  const open = await prisma.payment.findFirst({
    where: { storeId: input.store.id, purpose: input.purpose, provider: "CASH", status: "PENDING", reference: { startsWith: prefix } },
    orderBy: { createdAt: "desc" },
  });

  let reference = open?.reference;
  if (open) {
    if (Number(open.amount) !== input.amount || open.currency !== input.currency) {
      await prisma.payment.update({ where: { id: open.id }, data: { amount: input.amount, currency: input.currency } });
    }
  } else {
    // Unguessable: the pay page is reachable by whoever holds this reference (e.g. a guest with an invoice link).
    reference = `${prefix}${crypto.randomBytes(9).toString("hex")}`;
    await createPendingPayment({
      storeId: input.store.id,
      purpose: input.purpose,
      provider: "CASH",
      reference,
      amount: input.amount,
      currency: input.currency,
      bookingId: input.bookingId,
      reservationId: input.reservationId,
      travelTripId: input.travelTripId,
      tailoringJobId: input.tailoringJobId,
    });
  }
  return { reference: reference!, payUrl: buildStoreUrl(input.store, `/pay/${reference}`) };
}

export type ConfirmTransferOutcome = "paid" | "already_paid" | "not_found" | "not_manual" | "needs_review";

/**
 * The vendor confirms the transfer reached their account. Runs the same
 * settlement the gateway webhook would run for this purpose, so the invoice /
 * booking / quote / reservation moves exactly as it does for a card payment.
 */
export async function settleManualTransfer(input: { reference: string; storeId: string; confirmedByUserId?: string | null }): Promise<{ outcome: ConfirmTransferOutcome }> {
  const payment = await prisma.payment.findUnique({ where: { reference: input.reference } });
  if (!payment || payment.storeId !== input.storeId) return { outcome: "not_found" };
  if (payment.provider !== "CASH" || !isManualPurpose(payment.purpose)) return { outcome: "not_manual" };
  if (payment.status === "SUCCESSFUL") return { outcome: "already_paid" };

  const amount = Number(payment.amount);
  const raw = { method: "BANK_TRANSFER", confirmedBy: input.confirmedByUserId ?? null, proofUrl: payment.proofUrl ?? null };

  switch (payment.purpose) {
    case "INVOICE":
      await settleInvoicePayment(payment.reference, amount, raw);
      break;
    case "QUOTE_DEPOSIT":
      await settleQuoteDeposit(payment.reference, amount, raw);
      break;
    case "SERVICE_BOOKING":
      await settleServiceBookingPayment(payment.reference, "CASH", amount, raw);
      break;
    case "PMS_RESERVATION":
      await settleReservationPayment(payment.reference, "CASH", amount, raw);
      break;
    case "TRAVEL_BOOKING":
      await settleTravelPayment(payment.reference, "CASH", amount, raw);
      break;
    case "TAILORING_BALANCE":
      await settleTailoringPayment(payment.reference, "CASH", amount, raw);
      break;
  }

  // The settle* functions flag (rather than apply) anything they can't safely complete,
  // e.g. an invoice cancelled meanwhile or a quote that expired.
  const after = await prisma.payment.findUnique({ where: { reference: payment.reference }, select: { status: true } });
  return { outcome: after?.status === "SUCCESSFUL" ? "paid" : "needs_review" };
}
