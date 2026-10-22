import "server-only";

import { prisma } from "@/lib/prisma";
import { flagPaymentForReview } from "@/lib/payments/review";
import { escapeHtml } from "@/lib/payments/booking-confirmation";
import { sendOrderNotificationEmail } from "@/lib/email/send";
import type { ActionResult } from "@/types/actions";
import { revalidatePath } from "next/cache";

/**
 * Wallet funding settlement.
 * Lives outside "use server" files on purpose: a "use server" export is a public
 * endpoint, and this takes caller-supplied amounts/payloads. Import it only from
 * the webhook and callback route handlers.
 */

/**
 * Called only after a server-side gateway verification succeeds. The caller
 * supplies the verified amount from Paystack/Flutterwave; this function still
 * checks the stored Payment amount and performs the balance mutation inside a
 * serializable transaction so duplicate callbacks cannot credit twice.
 */
export async function settleWalletFunding(
  reference: string,
  provider: "PAYSTACK" | "FLUTTERWAVE",
  verifiedAmountNaira: number,
  rawPayload: object
): Promise<ActionResult<{ storeSlug: string }>> {
  const payment = await prisma.payment.findUnique({ where: { reference }, include: { wallet: { include: { store: true, user: true } } } });
  if (!payment || payment.purpose !== "WALLET_FUNDING" || !payment.wallet) return { success: false, error: "Wallet payment not found." };
  if (payment.provider !== provider) return { success: false, error: "Payment provider mismatch." };
  if (payment.status === "SUCCESSFUL") return { success: true, data: { storeSlug: payment.wallet.store.slug } };
  if (payment.status !== "PENDING") return { success: false, error: "Wallet payment is not pending." };
  if (Math.abs(Number(payment.amount) - Number(verifiedAmountNaira)) > 0.01) {
    await flagPaymentForReview(reference, `wallet funding amount mismatch (paid ${verifiedAmountNaira}, expected ${Number(payment.amount)})`, rawPayload);
    return { success: false, error: "Wallet funding amount mismatch." };
  }

  const amount = Number(payment.amount);
  await prisma.$transaction(async (tx) => {
    const fresh = await tx.storeWallet.findUnique({ where: { id: payment.wallet!.id } });
    if (!fresh || fresh.status !== "ACTIVE") throw new Error("WALLET_UNAVAILABLE");
    const paymentUpdate = await tx.payment.updateMany({
      where: { id: payment.id, status: "PENDING" },
      data: { status: "SUCCESSFUL", rawPayload, verifiedAt: new Date() },
    });
    if (paymentUpdate.count === 0) return;
    const updatedWallet = await tx.storeWallet.update({ where: { id: fresh.id }, data: { balance: { increment: amount } } });
    await tx.walletTransaction.create({
      data: {
        walletId: fresh.id,
        type: "FUNDING",
        amount,
        balanceAfter: updatedWallet.balance,
        reference: `FUND-${payment.reference}`,
        paymentId: payment.id,
        note: `${provider} wallet funding`,
      },
    });
  }, { isolationLevel: "Serializable" });

  const email = payment.wallet.user.email;
  if (email) {
    await sendOrderNotificationEmail(email, `Wallet funded — ${payment.wallet.store.name}`, `Your BizNest wallet at <strong>${escapeHtml(payment.wallet.store.name)}</strong> was funded with <strong>₦${amount.toLocaleString()}</strong>.<br/><br/>Reference: <strong>${escapeHtml(reference)}</strong>.`).catch(() => undefined);
  }
  revalidatePath(`/store/${payment.wallet.store.slug}/account/wallet`);
  return { success: true, data: { storeSlug: payment.wallet.store.slug } };
}
