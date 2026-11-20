import "server-only";
import { prisma } from "@/lib/prisma";
import { settleStoreTransfer } from "@/lib/payments/settle-store-transfer";
import { verifyKorapayTransaction } from "@/lib/payments/korapay";
import { verifyFlutterwaveTransaction } from "@/lib/payments/flutterwave";
import { verifyPaystackTransaction } from "@/lib/payments/paystack";

/**
 * Webhook branches for dedicated store accounts. Each returns a Response when the event was a
 * dedicated-account event (handled or deliberately ignored), or null so the caller carries on.
 * Every credit is re-verified with the gateway before money moves.
 */
type Json = Record<string, unknown>;
const ok = () => Response.json({ received: true });
const retry = () => Response.json({ error: "Verification unavailable, retry" }, { status: 502 });

export async function handleKorapayVirtualAccount(event: { event?: string; data?: Json }): Promise<Response | null> {
  if (event.event !== "charge.success") return null;
  const data = event.data ?? {};
  const details = data.virtual_bank_account_details as { virtual_bank_account?: { account_number?: string; account_reference?: string } } | undefined;
  const va = details?.virtual_bank_account;
  if (!va?.account_number && !va?.account_reference) return null;
  const reference = String(data.reference ?? "");
  if (!reference) return ok();
  const verification = await verifyKorapayTransaction(reference);
  if (verification.status !== "success") return retry();
  if (verification.data?.status !== "successful") return ok();
  await settleStoreTransfer({
    provider: "KORAPAY",
    accountNumber: va.account_number,
    accountReference: va.account_reference,
    gatewayReference: reference,
    verifiedAmountNaira: Number(verification.data.amount ?? 0),
    rawPayload: verification as object,
  });
  return ok();
}

export async function handleFlutterwaveVirtualAccount(event: { event?: string; data?: { id?: number; tx_ref?: string } }): Promise<Response | null> {
  if (event.event !== "charge.completed" || !event.data?.id || !event.data.tx_ref) return null;
  // A static account's credits carry the tx_ref we gave it when it was opened.
  const account = await prisma.storeVirtualAccount.findFirst({ where: { provider: "FLUTTERWAVE", reference: event.data.tx_ref }, select: { id: true } });
  if (!account) return null;
  const verification = await verifyFlutterwaveTransaction(String(event.data.id));
  if (verification.status !== "success") return retry();
  if (verification.data?.status !== "successful") return ok();
  await settleStoreTransfer({
    provider: "FLUTTERWAVE",
    accountReference: event.data.tx_ref,
    gatewayReference: String(event.data.id),
    verifiedAmountNaira: Number(verification.data.amount ?? 0),
    rawPayload: verification as object,
  });
  return ok();
}

export async function handlePaystackVirtualAccount(event: { event?: string; data?: Json }): Promise<Response | null> {
  const data = event.data ?? {};
  // The account number arrives asynchronously after we ask Paystack to assign one.
  if (event.event === "dedicatedaccount.assign.success") {
    const da = data.dedicated_account as { account_number?: string; account_name?: string; bank?: { name?: string } } | undefined;
    const email = String((data.customer as { email?: string } | undefined)?.email ?? "").toLowerCase();
    if (!da?.account_number || !email) return ok();
    const pending = await prisma.storeVirtualAccount.findFirst({
      where: { provider: "PAYSTACK", status: "PENDING", store: { business: { user: { email } } } },
      orderBy: { createdAt: "desc" },
      select: { id: true },
    });
    if (pending) {
      await prisma.storeVirtualAccount.update({
        where: { id: pending.id },
        data: { accountNumber: da.account_number, bankName: da.bank?.name ?? "Wema Bank", accountName: da.account_name ?? undefined, status: "ACTIVE" },
      });
    }
    return ok();
  }
  if (event.event === "dedicatedaccount.assign.failed") return ok();
  if (event.event !== "charge.success" || data.channel !== "dedicated_nuban") return null;
  const reference = String(data.reference ?? "");
  const accountNumber = String(
    (data.authorization as { receiver_bank_account_number?: string } | undefined)?.receiver_bank_account_number ?? (data.metadata as { receiver_account_number?: string } | undefined)?.receiver_account_number ?? ""
  );
  if (!reference || !accountNumber) return ok();
  const verification = await verifyPaystackTransaction(reference);
  if (!verification.status) return retry();
  if (verification.data?.status !== "success") return ok();
  await settleStoreTransfer({
    provider: "PAYSTACK",
    accountNumber,
    gatewayReference: reference,
    verifiedAmountNaira: Number(verification.data.amount ?? 0) / 100,
    rawPayload: verification as object,
  });
  return ok();
}
