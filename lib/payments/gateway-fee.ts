/**
 * Who bears the gateway fee.
 *
 * Current rule: the CUSTOMER pays it. Checkout adds the fee on top of the price (see customer-fee.ts), the
 * gateway keeps it out of the larger amount, and the vendor is paid the full price.
 *
 * Older payments (made before that rule, with no fee added) still follow the previous rule: the gateway keeps
 * its fee out of the price, so the vendor payout is (price - fee). A payment is "customer-covered" when the
 * gateway collected more than the price.
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

/**
 * Part of the gateway fee the CUSTOMER already paid on top of the price.
 *
 * Paystack can add its fee to the charge (bank transfer: requested 118.00,
 * collected 119.80, fees 1.80). The platform then nets exactly the price, so
 * taking the fee out of the vendor again would charge them twice. Only
 * Paystack's verify shape (kobo: amount, requested_amount, fees) is handled;
 * everything else returns 0 and behaves as before.
 */
export function customerPaidFeeNaira(provider: string, rawPayload: unknown, paymentAmount: number): number {
  if (provider !== "PAYSTACK") return 0;
  const root = asRecord(rawPayload);
  const data = asRecord(root?.data) ?? root;
  if (!data) return 0;
  const collected = num(data.amount) / 100;
  const requested = num(data.requested_amount) / 100 || paymentAmount;
  const fee = num(data.fees) / 100;
  if (collected <= 0 || requested <= 0 || fee <= 0) return 0;
  return round2(Math.max(0, Math.min(collected - requested, fee)));
}

/** Naira the gateway actually collected from the customer, from its verify response. 0 when unknown. */
export function collectedAmountNaira(provider: string, rawPayload: unknown): number {
  const root = asRecord(rawPayload);
  const data = asRecord(root?.data) ?? root;
  if (!data) return 0;
  if (provider === "PAYSTACK") return round2(num(data.amount) / 100);
  return round2(num(data.amount)); // Flutterwave and Korapay report naira
}

/** Did the customer pay the gateway fee on top of the price (collected more than the price)? */
export function customerCoveredFee(provider: string, rawPayload: unknown, priceNaira: number): boolean {
  const collected = collectedAmountNaira(provider, rawPayload);
  return collected > 0 && priceNaira > 0 && collected > priceNaira + 0.009 && extractGatewayFeeNaira(provider, rawPayload) > 0;
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
  paymentAmount: number,
  /**
   * Wallet payments carry no gateway response of their own: the gateway's fee was
   * taken when the customer topped up. Callers pass that wallet's real effective
   * fee rate (fee / topped-up amount, 0..1) so the vendor still bears it.
   */
  effectiveFeeRate?: number,
  /** What the customer was asked to pay for the goods (Payment.amount), before commission. Defaults to paymentAmount. */
  priceNaira?: number
): { amount: number; feeAmount: number } {
  if (!VENDOR_BEARS_GATEWAY_FEE) return { amount: round2(paymentAmount), feeAmount: 0 };
  // The customer already paid the gateway's fee on top of the price: the vendor gets the full price and bears nothing.
  // (Any small gap between the estimate and the real fee is BizNest's, never the vendor's.)
  if (customerCoveredFee(provider, rawPayload, priceNaira ?? paymentAmount)) {
    return { amount: round2(Math.max(0, paymentAmount - transferFeeNaira())), feeAmount: Math.min(transferFeeNaira(), round2(paymentAmount)) };
  }

  let collectionFee = extractGatewayFeeNaira(provider, rawPayload);
  // The vendor only bears the part of the fee that came out of the price itself.
  collectionFee = round2(Math.max(0, collectionFee - customerPaidFeeNaira(provider, rawPayload, paymentAmount)));
  const gatewayFeeKnown = collectionFee > 0 || extractGatewayFeeNaira(provider, rawPayload) > 0;
  if (collectionFee === 0 && !gatewayFeeKnown && effectiveFeeRate && effectiveFeeRate > 0 && effectiveFeeRate < 1) {
    collectionFee = round2(paymentAmount * effectiveFeeRate);
  }
  if (collectionFee === 0 && !gatewayFeeKnown) {
    const pct = Number(process.env.GATEWAY_FEE_FALLBACK_PERCENT ?? 0);
    if (Number.isFinite(pct) && pct > 0) collectionFee = round2((paymentAmount * pct) / 100);
  }
  const feeAmount = Math.min(round2(collectionFee + transferFeeNaira()), round2(paymentAmount));
  return { amount: round2(paymentAmount - feeAmount), feeAmount };
}

/**
 * Effective gateway fee rate (0..1) a wallet's top-ups actually cost, from the
 * verify payloads stored on its successful WALLET_FUNDING payments.
 * Returns 0 when there is no usable history (callers then fall back to
 * GATEWAY_FEE_FALLBACK_PERCENT).
 */
export function walletEffectiveFeeRate(fundings: Array<{ provider: string; amount: unknown; rawPayload: unknown }>): number {
  let funded = 0;
  let fees = 0;
  for (const f of fundings) {
    const amount = Number(f.amount);
    if (!Number.isFinite(amount) || amount <= 0) continue;
    funded += amount;
    // A fee the customer paid on top of the top-up is not a cost to the vendor.
    if (customerCoveredFee(f.provider, f.rawPayload, amount)) continue;
    fees += Math.max(0, extractGatewayFeeNaira(f.provider, f.rawPayload) - customerPaidFeeNaira(f.provider, f.rawPayload, amount));
  }
  if (funded <= 0 || fees <= 0) return 0;
  return Math.min(fees / funded, 0.5);
}
