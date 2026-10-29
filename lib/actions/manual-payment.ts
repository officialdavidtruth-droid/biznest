"use server";

import { revalidatePath } from "next/cache";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { assertStorePermission } from "@/lib/access/assert-store-access";
import { logStoreActivity } from "@/lib/activity-log";
import { normalizeWhatsapp } from "@/lib/payments/manual-transfer";
import { settleManualOrderPayment } from "@/lib/payments/settle-manual-order";
import type { ActionResult } from "@/types/actions";

export type ManualPaymentSettingsInput = {
  enabled: boolean;
  bankName: string;
  accountName: string;
  accountNumber: string;
  note: string;
  whatsapp: string;
};

/** Vendor publishes (or updates) the account customers pay into, plus their WhatsApp contact. */
export async function saveManualPaymentSettings(slug: string, input: ManualPaymentSettingsInput): Promise<ActionResult> {
  const access = await assertStorePermission(slug, "payments");
  if (!access.success) return { success: false, error: access.error };

  const bankName = input.bankName.trim().slice(0, 80);
  const accountName = input.accountName.trim().slice(0, 120);
  const accountNumber = input.accountNumber.replace(/\s+/g, "").slice(0, 34);
  const note = input.note.trim().slice(0, 500);
  const whatsappRaw = input.whatsapp.trim();
  const whatsapp = whatsappRaw ? normalizeWhatsapp(whatsappRaw) : null;

  if (whatsappRaw && !whatsapp) return { success: false, error: "That WhatsApp number doesn't look right. Use the international format, e.g. +234 801 234 5678." };
  if (input.enabled) {
    if (!bankName || !accountName || !accountNumber) return { success: false, error: "Add the bank name, account name and account number before turning this on." };
    if (!/^[0-9A-Za-z-]{6,34}$/.test(accountNumber)) return { success: false, error: "The account number can only contain letters, digits and dashes." };
    if (!whatsapp) return { success: false, error: "Add your WhatsApp number so customers can reach you if confirming takes time." };
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
