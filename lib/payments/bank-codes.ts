import "server-only";
import { prisma } from "@/lib/prisma";
import { listFlutterwaveBanks, resolveFlutterwaveAccount } from "@/lib/payments/flutterwave";
import { listPaystackBanks, resolvePaystackAccount } from "@/lib/payments/paystack";
import { logError, logInfo } from "@/lib/observability/log";
import type { TransferGateway } from "@/lib/payments/payout-gateway";

/**
 * Bank codes are not the same on both gateways for every bank (Opay and
 * Palmpay differ), so a code saved while connecting through one gateway can
 * be rejected by the other. This returns the right code for the gateway that
 * is about to move the money.
 *
 * Order of preference:
 *  1. a code already stored for that gateway (payoutDetails.codes)
 *  2. the store's own code, when it was saved through that same gateway
 *  3. derive it: find the bank by name in the target gateway's list, then PROVE
 *     it by resolving the account number there and checking the account name
 *     matches. A wrong guess can never send money to the wrong bank, because a
 *     code is only accepted when the bank returns this vendor's name.
 * A derived code is saved, so the lookup happens once per store per gateway.
 */

export type PayoutDetails = {
  provider?: TransferGateway;
  bankName?: string;
  accountName?: string;
  maskedAccountNumber?: string;
  codes?: Partial<Record<TransferGateway, string>>;
};

type StoreBank = { id: string; payoutBankCode: string | null; payoutAccountNumber: string | null; payoutDetails: unknown };

// Words that differ between how gateways spell the same bank.
const NOISE = /\b(bank|plc|ltd|limited|nigeria|nig|of|the|microfinance|mfb|digital|services|technologies|financial|and|&)\b/g;

export function normalizeBankName(name: string): string {
  return name.toLowerCase().replace(/\(.*?\)/g, " ").replace(NOISE, " ").replace(/[^a-z0-9]/g, "");
}

// Banks whose gateway-listed names are unrelated to their brand (Flutterwave lists Opay as "Paycom").
const ALIASES: Record<string, string[]> = {
  opay: ["paycom", "opay"],
  paycom: ["opay", "paycom"],
  palmpay: ["palmpay"],
  moniepoint: ["moniepoint"],
  kuda: ["kuda"],
};

/** True when two account names plausibly belong to the same person (word sets overlap fully one way). */
export function accountNamesMatch(a: string, b: string): boolean {
  const tokens = (s: string) => s.toLowerCase().split(/[^a-z0-9]+/).filter((t) => t.length > 1);
  const ta = tokens(a);
  const tb = tokens(b);
  if (ta.length === 0 || tb.length === 0) return false;
  const [small, big] = ta.length <= tb.length ? [ta, tb] : [tb, ta];
  return small.every((t) => big.includes(t));
}

export function candidateBanks(bankName: string, banks: { name: string; code: string }[]): { name: string; code: string }[] {
  const target = normalizeBankName(bankName);
  if (!target) return [];
  const wanted = new Set<string>([target, ...(ALIASES[target] ?? [])]);
  const exact = banks.filter((b) => wanted.has(normalizeBankName(b.name)));
  if (exact.length > 0) return exact.slice(0, 3);
  const loose = banks.filter((b) => {
    const n = normalizeBankName(b.name);
    return n && (n.includes(target) || target.includes(n));
  });
  return loose.slice(0, 3);
}

async function resolveOn(gateway: TransferGateway, accountNumber: string, bankCode: string): Promise<string | null> {
  if (gateway === "FLUTTERWAVE") {
    const r = await resolveFlutterwaveAccount(accountNumber, bankCode);
    return r.status === "success" && r.data ? r.data.account_name : null;
  }
  const r = await resolvePaystackAccount(accountNumber, bankCode);
  return r.status && r.data ? r.data.account_name : null;
}

export async function resolveBankCodeForGateway(
  store: StoreBank,
  gateway: TransferGateway
): Promise<{ code: string } | { error: string }> {
  if (!store.payoutBankCode || !store.payoutAccountNumber) return { error: "Store has not connected a bank account yet." };
  const details = (store.payoutDetails ?? null) as PayoutDetails | null;

  const stored = details?.codes?.[gateway];
  if (stored) return { code: stored };

  // Connected through this very gateway (or before provider was recorded, when Paystack was the only one).
  const savedWith = details?.provider ?? "PAYSTACK";
  if (savedWith === gateway) return { code: store.payoutBankCode };

  const bankName = details?.bankName;
  if (!bankName) return { error: `Can't match this bank on ${gateway === "FLUTTERWAVE" ? "Flutterwave" : "Paystack"}: reconnect the bank account.` };

  const list = gateway === "FLUTTERWAVE" ? await listFlutterwaveBanks() : await listPaystackBanks();
  if (!list.status) return { error: `Couldn't load the ${gateway === "FLUTTERWAVE" ? "Flutterwave" : "Paystack"} bank list: ${list.message}` };

  const expectedName = details?.accountName ?? "";
  for (const candidate of candidateBanks(bankName, list.banks)) {
    const resolvedName = await resolveOn(gateway, store.payoutAccountNumber, candidate.code).catch(() => null);
    if (resolvedName && (!expectedName || accountNamesMatch(expectedName, resolvedName))) {
      const codes = { ...(details?.codes ?? {}), [savedWith]: store.payoutBankCode, [gateway]: candidate.code };
      await prisma.store
        .update({ where: { id: store.id }, data: { payoutDetails: { ...(details ?? {}), codes } as object } })
        .catch((err) => void logError("PAYMENTS", "Couldn't save derived bank code", { storeId: store.id, message: err instanceof Error ? err.message : String(err) }));
      void logInfo("PAYMENTS", "Derived bank code for gateway", { storeId: store.id, gateway });
      return { code: candidate.code };
    }
  }
  return { error: `Couldn't confirm this bank account on ${gateway === "FLUTTERWAVE" ? "Flutterwave" : "Paystack"}. Ask the store to reconnect its bank account.` };
}
