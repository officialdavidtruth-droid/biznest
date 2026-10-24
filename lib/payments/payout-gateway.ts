import "server-only";
import {
  createPaystackTransferRecipient,
  getPaystackBalanceKobo,
  initiatePaystackTransfer,
  verifyPaystackTransfer,
} from "@/lib/payments/paystack";
import {
  getKorapayBalanceNaira,
  initiateKorapayTransfer,
  verifyKorapayTransfer,
} from "@/lib/payments/korapay";
import { APP_URL } from "@/lib/constants/app-url";
import {
  findFlutterwaveTransferByReference,
  getFlutterwaveBalanceNaira,
  initiateFlutterwaveTransfer,
} from "@/lib/payments/flutterwave";

/**
 * One interface over the three gateways' Transfer APIs, so payout.ts holds the
 * safety logic (idempotent references, retries, claims) exactly once.
 *
 * Amounts cross this boundary in kobo; the Flutterwave adapter converts to
 * naira because Flutterwave works in the major currency unit.
 */

export type TransferGateway = "PAYSTACK" | "FLUTTERWAVE" | "KORAPAY";

/** Gateway-neutral transfer record: `transfer_code` holds Paystack's code or Flutterwave's numeric id as a string. */
export type NormalizedTransfer = { transfer_code?: string; status?: string };

export type LookupResult =
  | { found: true; data: NormalizedTransfer; raw: object }
  | { found: false; /** true only when the gateway positively says no such transfer exists */ notFound: boolean; message: string };

export type SendResult =
  | { ok: true; data: NormalizedTransfer; raw: object }
  | { ok: false; message: string };

/**
 * Which gateway moves the money for a payout. Customer money sits in the
 * gateway it was paid through, so PAYSTACK/FLUTTERWAVE payments follow their
 * own provider. Wallet payments have no single source gateway: the choice is
 * made once when the payout is queued and stored in Payout.destination, so
 * later retries and lookups never flip to the other gateway.
 */
export function gatewayForPayout(provider: string, destination: unknown): TransferGateway {
  const stored = (destination as { transferGateway?: string } | null | undefined)?.transferGateway;
  if (stored === "FLUTTERWAVE" || stored === "PAYSTACK" || stored === "KORAPAY") return stored;
  if (provider === "KORAPAY") return "KORAPAY";
  return provider === "FLUTTERWAVE" ? "FLUTTERWAVE" : "PAYSTACK";
}

/** Platform balance at the gateway in kobo, or null when it couldn't be read. */
export async function getGatewayBalanceKobo(gateway: TransferGateway): Promise<number | null> {
  if (gateway === "KORAPAY") {
    const res = await getKorapayBalanceNaira();
    return res.status && typeof res.balanceNaira === "number" ? Math.round(res.balanceNaira * 100) : null;
  }
  if (gateway === "FLUTTERWAVE") {
    const res = await getFlutterwaveBalanceNaira();
    return res.status && typeof res.balanceNaira === "number" ? Math.round(res.balanceNaira * 100) : null;
  }
  const res = await getPaystackBalanceKobo();
  return res.balanceKobo ?? null;
}

export async function lookupGatewayTransfer(gateway: TransferGateway, reference: string): Promise<LookupResult> {
  if (gateway === "KORAPAY") {
    const res = await verifyKorapayTransfer(reference);
    if (res.status && res.data) {
      // Kora has no separate transfer id: our reference is the handle.
      return { found: true, data: { transfer_code: res.data.reference ?? reference, status: res.data.status }, raw: res };
    }
    return { found: false, notFound: res.notFound, message: res.message };
  }
  if (gateway === "FLUTTERWAVE") {
    const res = await findFlutterwaveTransferByReference(reference);
    if (res.status !== "success") {
      return { found: false, notFound: /not found|no transfer/i.test(res.message ?? ""), message: res.message ?? "" };
    }
    // Exact match only: the list endpoint must never hand us someone else's transfer.
    const match = res.data.find((t) => t.reference === reference);
    if (!match) return { found: false, notFound: true, message: "Transfer not found" };
    return { found: true, data: { transfer_code: String(match.id), status: match.status }, raw: res };
  }
  const res = await verifyPaystackTransfer(reference);
  if (res.status && res.data) return { found: true, data: res.data, raw: res };
  return { found: false, notFound: /not found/i.test(res.message ?? ""), message: res.message ?? "" };
}

export async function sendGatewayTransfer(
  gateway: TransferGateway,
  p: {
    amountKobo: number;
    reference: string;
    narration: string;
    bankCode: string;
    accountNumber: string;
    beneficiaryName?: string;
    /** Paystack only: the registered transfer recipient. */
    recipientCode?: string;
  }
): Promise<SendResult> {
  if (gateway === "KORAPAY") {
    const res = await initiateKorapayTransfer({
      bankCode: p.bankCode,
      accountNumber: p.accountNumber,
      amountNaira: p.amountKobo / 100,
      reference: p.reference,
      narration: p.narration,
      beneficiaryName: p.beneficiaryName,
      notificationUrl: `${APP_URL}/api/payments/korapay/webhook`,
    });
    if (!res.status || !res.data) return { ok: false, message: res.message || "Transfer was not accepted." };
    return { ok: true, data: { transfer_code: res.data.reference ?? p.reference, status: res.data.status }, raw: res };
  }
  if (gateway === "FLUTTERWAVE") {
    const res = await initiateFlutterwaveTransfer({
      bankCode: p.bankCode,
      accountNumber: p.accountNumber,
      amountNaira: p.amountKobo / 100,
      reference: p.reference,
      narration: p.narration,
      beneficiaryName: p.beneficiaryName,
    });
    if (res.status !== "success" || !res.data) return { ok: false, message: res.message || "Transfer was not accepted." };
    return { ok: true, data: { transfer_code: String(res.data.id), status: res.data.status }, raw: res };
  }
  const res = await initiatePaystackTransfer({
    amountKobo: p.amountKobo,
    recipientCode: p.recipientCode ?? "",
    reference: p.reference,
    reason: p.narration,
  });
  if (!res.status || !res.data) return { ok: false, message: res.message || "Transfer was not accepted." };
  return { ok: true, data: res.data, raw: res };
}

/** Paystack needs a registered recipient before it can send; Flutterwave and Korapay take bank details directly. */
export { createPaystackTransferRecipient };
