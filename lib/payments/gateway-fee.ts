/**
 * Gateway fees are charged to the vendor, not to BizNest.
 *
 * The customer pays exactly the order total. The gateway keeps its fee out of
 * that, so the platform balance only ever receives (total - fee). The vendor
 * payout is therefore (total - fee - transfer fee): the balance covers every
 * payout exactly and never drains.
 *
 * The fee is read from the gateway's own verify response (stored on
 * Payment.rawPayload), not estimated, so it matches what the gateway really took.
 */

/** Flip to false to go back to BizNest absorbing gateway fees (vendors get 100%). */
export const VENDOR_BEARS_GATEWAY_FEE = true;

const round2 = (n: number) => Math.round(n * 100) / 100;

function num(v: unknown): number {
  const n = typeof v === "string" ? Number(v) : typeof v === "number" ? v : NaN;
  return Number.isFinite(n) && n > 0 ? n : 0;
}

function asRecord(v: unknown): Record<string, unknown> | null {
  return v && typeof v === "object" && !Array.isArray(v) ? (v as Record<string, unknown>) : null;
}

/**
 * Fee the gateway kept from a collection, in naira. Returns 0 when the payload
 * doesn't carry one (the caller then falls back to GATEWAY_FEE_FALLBACK_PERCENT).
 *
 * Shapes (all stored as the verify response, possibly nested under `data`):
 *  - Korapay:     data.raw.fee (+ data.raw.vat), naira
 *  - Flutterwave: data.app_fee (+ data.merchant_fee), naira
 *  - Paystack:    data.fees, kobo
 */
export function extractGatewayFeeNaira(provider: string, rawPayload: unknown): number {
  const root = asRecord(rawPayload);
  const data = asRecord(root?.data) ?? root;
  if (!data) return 0;

  if (provider === "KORAPAY") {
    const raw = asRecord(data.raw) ?? data;
    return round2(num(raw.fee) + num(raw.vat));
  }
  if (provider === "FLUTTERWAVE") {
    return round2(num(data.app_fee) + num(data.merchant_fee));
  }
  if (provider === "PAYSTACK") {
    return round2(num(data.fees) / 100);
  }
  return 0;
}

/** Flat fee BizNest pays the gateway per payout transfer, passed on to the vendor. Default 0. */
export function transferFeeNaira(): number {
  return round2(num(process.env.PAYOUT_TRANSFER_FEE_NAIRA));
}

/**
 * What the vendor is paid for a payment of `paymentAmount` (naira, already net of commission).
 * Never negative; `feeAmount` is the part held back, for display and audit.
 */
export function vendorPayoutAmount(
  provider: string,
  rawPayload: unknown,
  paymentAmount: number
): { amount: number; feeAmount: number } {
  if (!VENDOR_BEARS_GATEWAY_FEE) return { amount: round2(paymentAmount), feeAmount: 0 };

  let collectionFee = extractGatewayFeeNaira(provider, rawPayload);
  if (collectionFee === 0) {
    const pct = Number(process.env.GATEWAY_FEE_FALLBACK_PERCENT ?? 0);
    if (Number.isFinite(pct) && pct > 0) collectionFee = round2((paymentAmount * pct) / 100);
  }
  const feeAmount = Math.min(round2(collectionFee + transferFeeNaira()), round2(paymentAmount));
  return { amount: round2(paymentAmount - feeAmount), feeAmount };
}
