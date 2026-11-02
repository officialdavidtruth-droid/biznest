"use server";

import { revalidatePath } from "next/cache";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { assertStorePermission } from "@/lib/access/assert-store-access";
import { logStoreActivity } from "@/lib/activity-log";
import { normalizeWhatsapp } from "@/lib/payments/manual-transfer";
import { settleManualOrderPayment } from "@/lib/payments/settle-manual-order";
import { settleManualTransfer, MANUAL_PURPOSE_LABEL, isManualPurpose } from "@/lib/payments/manual-flow";
import type { ActionResult } from "@/types/actions";

export type ManualPaymentSettingsInput = {
  enabled: boolean;
  bankName: string;
  accountName: string;
  accountNumber: string;
  note: string;
  whatsapp: string;
  call: string;
};

/** Vendor publishes (or updates) the account customers pay into, plus their WhatsApp number and call line. */
export async function saveManualPaymentSettings(slug: string, input: ManualPaymentSettingsInput): Promise<ActionResult> {
  const access = await assertStorePermission(slug, "payments");
  if (!access.success) return { success: false, error: access.error };

  const bankName = input.bankName.trim().slice(0, 80);
  const accountName = input.accountName.trim().slice(0, 120);
  const accountNumber = input.accountNumber.replace(/\s+/g, "").slice(0, 34);
  const note = input.note.trim().slice(0, 500);
  const whatsappRaw = input.whatsapp.trim();
  const whatsapp = whatsappRaw ? normalizeWhatsapp(whatsappRaw) : null;
  const callRaw = (input.call ?? "").trim();
  const call = callRaw ? normalizeWhatsapp(callRaw) : null;

  if (whatsappRaw && !whatsapp) return { success: false, error: "That WhatsApp number doesn't look right. Use the international format, e.g. +234 801 234 5678." };
  if (callRaw && !call) return { success: false, error: "That call line doesn't look right. Use the international format, e.g. +234 801 234 5678." };
  if (input.enabled) {
    if (!bankName || !accountName || !accountNumber) return { success: false, error: "Add the bank name, account name and account number before turning this on." };
    if (!/^[0-9A-Za-z-]{6,34}$/.test(accountNumber)) return { success: false, error: "The account number can only contain letters, digits and dashes." };
    if (!whatsapp && !call) return { success: false, error: "Add your WhatsApp number or call line so customers can reach you if confirming takes time." };
  }

  await prisma.store.update({
    where: { id: access.store.id },
    data: {
      manualPayEnabled: input.enabled,
      manualBankName: bankName || null,
      manualAccountName: accountName || null,
      manualAccountNumber: accountNumber || null,
      manualPayNote: note || null,
      whatsappNumber: whatsapp,
      // The call line is the store's contact phone (also used in the storefront footer).
      contactPhone: call ? `+${call}` : null,
    },
  });

  const session = await auth();
  await logStoreActivity({
    storeId: access.store.id,
    actor: { id: session?.user?.id, name: session?.user?.name, email: session?.user?.email, role: session?.user?.role ?? "unknown" },
    action: "payments.bank_details_updated",
    metadata: { enabled: input.enabled },
  });

  revalidatePath(`/store/${slug}/admin/payments`);
  return { success: true, data: undefined };
}

/** Vendor confirms the transfer landed in their account: the order becomes PAID and normal fulfilment starts. */
export async function confirmManualOrderPayment(slug: string, orderId: string): Promise<ActionResult> {
  const access = await assertStorePermission(slug, "orders");
  if (!access.success) return { success: false, error: access.error };

  const session = await auth();
  const result = await settleManualOrderPayment({ orderId, storeId: access.store.id, confirmedByUserId: session?.user?.id ?? null });

  if (result.outcome === "not_found") return { success: false, error: "Order not found." };
  if (result.outcome === "not_manual") return { success: false, error: "This order wasn't paid by bank transfer." };
  if (result.outcome === "already_paid") return { success: false, error: "This order is already marked as paid." };

  await logStoreActivity({
    storeId: access.store.id,
    actor: { id: session?.user?.id, name: session?.user?.name, email: session?.user?.email, role: session?.user?.role ?? "unknown" },
    action: "order.bank_transfer_confirmed",
    target: orderId,
  });

  revalidatePath(`/store/${slug}/admin/orders`);
  revalidatePath(`/store/${slug}/admin/orders/${orderId}`);
  return { success: true, data: undefined };
}


export type PendingTransfer = {
  reference: string;
  purposeLabel: string;
  amount: number;
  currency: string;
  createdAt: string;
  proofUrl: string | null;
  proofAt: string | null;
  proofNote: string | null;
};

/** Open bank transfers for invoices, quote deposits, bookings and PMS deposits, waiting for the vendor to confirm. */
export async function getPendingTransfers(slug: string): Promise<PendingTransfer[]> {
  const access = await assertStorePermission(slug, "payments");
  if (!access.success) return [];
  const rows = await prisma.payment.findMany({
    where: { storeId: access.store.id, provider: "CASH", status: "PENDING", purpose: { in: ["INVOICE", "QUOTE_DEPOSIT", "SERVICE_BOOKING", "PMS_RESERVATION", "TRAVEL_BOOKING"] } },
    orderBy: [{ proofAt: { sort: "desc", nulls: "last" } }, { createdAt: "desc" }],
    take: 100,
  });
  return rows.filter((r) => isManualPurpose(r.purpose)).map((r) => ({
    reference: r.reference,
    purposeLabel: MANUAL_PURPOSE_LABEL[r.purpose as keyof typeof MANUAL_PURPOSE_LABEL],
    amount: Number(r.amount),
    currency: r.currency,
    createdAt: r.createdAt.toISOString(),
    proofUrl: r.proofUrl,
    proofAt: r.proofAt?.toISOString() ?? null,
    proofNote: r.proofNote,
  }));
}

/** Vendor confirms an invoice / quote deposit / booking / PMS deposit transfer reached their account. */
export async function confirmManualTransferPayment(slug: string, reference: string): Promise<ActionResult> {
  const access = await assertStorePermission(slug, "payments");
  if (!access.success) return { success: false, error: access.error };

  const session = await auth();
  const result = await settleManualTransfer({ reference, storeId: access.store.id, confirmedByUserId: session?.user?.id ?? null });

  if (result.outcome === "not_found") return { success: false, error: "Payment not found." };
  if (result.outcome === "not_manual") return { success: false, error: "This payment wasn't made by bank transfer." };
  if (result.outcome === "already_paid") return { success: false, error: "This payment is already confirmed." };
  if (result.outcome === "needs_review") {
    return { success: false, error: "This payment couldn't be applied automatically (the invoice, quote or booking may have been cancelled or expired meanwhile). It has been flagged for review." };
  }

  await logStoreActivity({
    storeId: access.store.id,
    actor: { id: session?.user?.id, name: session?.user?.name, email: session?.user?.email, role: session?.user?.role ?? "unknown" },
    action: "payment.bank_transfer_confirmed",
    target: reference,
  });

  revalidatePath(`/store/${slug}/admin/payments`);
  revalidatePath(`/store/${slug}/admin/invoices`);
  revalidatePath(`/store/${slug}/admin/quotes`);
  revalidatePath(`/store/${slug}/admin/bookings`);
  revalidatePath(`/store/${slug}/admin/pms`);
  return { success: true, data: undefined };
}
