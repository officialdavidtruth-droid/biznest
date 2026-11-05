import "server-only";
import { prisma } from "@/lib/prisma";
import { listFlutterwaveBanks, resolveFlutterwaveAccount } from "@/lib/payments/flutterwave";
import { listKorapayBanks, resolveKorapayAccount } from "@/lib/payments/korapay";
import { listPaystackBanks, resolvePaystackAccount } from "@/lib/payments/paystack";
import { accountNamesMatch, candidateBanks } from "@/lib/payments/bank-codes";
import { logError, logInfo } from "@/lib/observability/log";
import type { TransferGateway } from "@/lib/payments/payout-gateway";

export type AdoptResult = { ok: true; alreadyConnected: boolean } | { ok: false; reason: string };

async function resolveOn(gateway: TransferGateway, accountNumber: string, bankCode: string): Promise<string | null> {
  if (gateway === "KORAPAY") {
    const r = await resolveKorapayAccount(accountNumber, bankCode, { fixedIp: true });
    return r.status && r.data ? r.data.account_name : null;
  }
  if (gateway === "FLUTTERWAVE") {
    const r = await resolveFlutterwaveAccount(accountNumber, bankCode);
    return r.status === "success" && r.data ? r.data.account_name : null;
  }
  const r = await resolvePaystackAccount(accountNumber, bankCode);
  return r.status && r.data ? r.data.account_name : null;
}

/**
 * Lets a vendor who only filled in the "Accept payment by bank transfer" details
 * be paid out to that same account, so wallet payments reach them.
 *
 * Nothing is trusted from what the vendor typed except the account number and a
 * bank name. The bank is found in the gateway's list and the number is resolved
 * there; the code is accepted only when the bank returns a holder name that
 * matches the account name the vendor entered. Anything else leaves the store
 * untouched and returns a reason. An existing payout account is never replaced.
 */
export async function adoptManualBankForPayout(storeId: string, gateway: TransferGateway): Promise<AdoptResult> {
  const store = await prisma.store.findUnique({
    where: { id: storeId },
    select: { id: true, payoutBankCode: true, payoutAccountNumber: true, manualBankName: true, manualAccountName: true, manualAccountNumber: true },
  });
  if (!store) return { ok: false, reason: "Store not found." };
  if (store.payoutBankCode && store.payoutAccountNumber) return { ok: true, alreadyConnected: true };

  const number = (store.manualAccountNumber ?? "").replace(/\s+/g, "");
  if (!store.manualBankName || !store.manualAccountName || !/^\d{10}$/.test(number)) {
    return { ok: false, reason: "The store has not added complete bank details." };
  }

  try {
    const list = gateway === "FLUTTERWAVE" ? await listFlutterwaveBanks() : gateway === "KORAPAY" ? await listKorapayBanks({ fixedIp: true }) : await listPaystackBanks();
    if (!list.status) return { ok: false, reason: "Couldn't load the bank list." };

    for (const candidate of candidateBanks(store.manualBankName, list.banks)) {
      const resolved = await resolveOn(gateway, number, candidate.code).catch(() => null);
      if (!resolved || !accountNamesMatch(store.manualAccountName, resolved)) continue;

      // Re-check inside the write so a payout account connected in the meantime is never overwritten.
      const now = new Date();
      const updated = await prisma.store.updateMany({
        where: { id: store.id, payoutBankCode: null },
        data: {
          payoutBankCode: candidate.code,
          payoutAccountNumber: number,
          paystackRecipientCode: null,
          payoutConnectedAt: now,
          payoutDetails: {
            provider: gateway,
            bankName: candidate.name,
            accountName: resolved,
            maskedAccountNumber: `••••••${number.slice(-4)}`,
            codes: { [gateway]: candidate.code },
            source: "manual-bank-transfer-details",
          },
        },
      });
      void logInfo("PAYMENTS", "Payout account taken from bank-transfer details", { storeId: store.id, gateway, connected: updated.count > 0 });
      return { ok: true, alreadyConnected: updated.count === 0 };
    }
    return { ok: false, reason: "Couldn't confirm that the account number belongs to the account name entered." };
  } catch (error) {
    void logError("PAYMENTS", "Adopting bank-transfer details for payouts failed", { storeId, message: error instanceof Error ? error.message : String(error) });
    return { ok: false, reason: "Couldn't check the bank account right now." };
  }
}
