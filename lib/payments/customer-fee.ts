/**
 * Customer pays the gateway's transaction fee, so the vendor receives the full price.
 *
 * The customer is charged `total` instead of `price`, chosen so that after the gateway keeps its fee the
 * platform still holds at least `price`. The vendor is then paid `price` in full (see gateway-fee.ts).
 *
 * Gateways publish their fee as a percentage, sometimes plus a flat amount, with a cap per transaction.
 * The defaults below are the published Nigerian local rates; accounts on negotiated pricing should override
 * them in the environment (no code change):
 *   GATEWAY_FEE_<PAYSTACK|FLUTTERWAVE|KORAPAY>_PERCENT / _FLAT / _CAP / _FLAT_WAIVED_BELOW
 *   GATEWAY_FEE_VAT_PERCENT    VAT charged on top of the fee, if the gateway adds it (default 0)
 *   CUSTOMER_PAYS_GATEWAY_FEE  set to "false" to stop adding the fee (BizNest absorbs it)
 */
export type FeeGateway = "PAYSTACK" | "FLUTTERWAVE" | "KORAPAY";

export type FeeSchedule = {
  /** Percentage of the charged amount, e.g. 1.5 */
  percent: number;
  /** Flat naira added to the percentage */
  flat: number;
  /** The flat part is waived when the charge is at or below this amount (Paystack: 2,500) */
  flatWaivedAtOrBelow: number;
  /** Most the gateway will ever take from one transaction, in naira */
  cap: number;
};

const DEFAULTS: Record<FeeGateway, FeeSchedule> = {
  PAYSTACK: { percent: 1.5, flat: 100, flatWaivedAtOrBelow: 2500, cap: 2000 },
  FLUTTERWAVE: { percent: 1.4, flat: 0, flatWaivedAtOrBelow: 0, cap: 2000 },
  KORAPAY: { percent: 1.5, flat: 0, flatWaivedAtOrBelow: 0, cap: 2000 },
};

const round2 = (n: number) => Math.round(n * 100) / 100;
const ceil2 = (n: number) => Math.ceil(n * 100 - 1e-9) / 100;

function envNum(name: string, fallback: number): number {
  const raw = process.env[name];
  if (raw === undefined || raw.trim() === "") return fallback;
  const n = Number(raw);
  return Number.isFinite(n) && n >= 0 ? n : fallback;
}

export function customerPaysGatewayFee(): boolean {
  return process.env.CUSTOMER_PAYS_GATEWAY_FEE?.trim().toLowerCase() !== "false";
}

export function feeSchedule(gateway: FeeGateway): FeeSchedule {
  const d = DEFAULTS[gateway];
  const p = `GATEWAY_FEE_${gateway}_`;
  return {
    percent: envNum(`${p}PERCENT`, d.percent),
    flat: envNum(`${p}FLAT`, d.flat),
    flatWaivedAtOrBelow: envNum(`${p}FLAT_WAIVED_BELOW`, d.flatWaivedAtOrBelow),
    cap: envNum(`${p}CAP`, d.cap),
  };
}

/** What the gateway would take from a charge of `chargedNaira`. */
export function gatewayFeeOn(chargedNaira: number, s: FeeSchedule, vatPercent = envNum("GATEWAY_FEE_VAT_PERCENT", 0)): number {
  const flat = s.flatWaivedAtOrBelow > 0 && chargedNaira <= s.flatWaivedAtOrBelow ? 0 : s.flat;
  const base = (chargedNaira * s.percent) / 100 + flat;
  const withVat = base * (1 + vatPercent / 100);
  return round2(Math.min(withVat, s.cap > 0 ? s.cap : withVat));
}

/**
 * The amount to charge so that, after the gateway's fee, `priceNaira` is left.
 * Returns the price unchanged (fee 0) when the feature is off or the price is not a positive amount.
 */
export function grossUpForGatewayFee(
  gateway: FeeGateway,
  priceNaira: number,
  schedule: FeeSchedule = feeSchedule(gateway),
  vatPercent: number = envNum("GATEWAY_FEE_VAT_PERCENT", 0),
  enabled: boolean = customerPaysGatewayFee(),
): { totalNaira: number; feeNaira: number } {
  if (!Number.isFinite(priceNaira) || priceNaira <= 0 || !enabled) {
    return { totalNaira: round2(Number.isFinite(priceNaira) ? priceNaira : 0), feeNaira: 0 };
  }
  const k = (schedule.percent / 100) * (1 + vatPercent / 100);
  const flatWith = schedule.flat * (1 + vatPercent / 100);
  const cap = schedule.cap > 0 ? schedule.cap : Number.POSITIVE_INFINITY;

  // Case 1: the fee is capped.
  const capped = priceNaira + cap;
  // Case 2: fee = k*T + flat  =>  T = (price + flat) / (1 - k)
  let total = (priceNaira + flatWith) / (1 - k);
  // Flat fee is waived on small charges: if that charge lands at or under the threshold, use the no-flat version.
  if (schedule.flatWaivedAtOrBelow > 0) {
    const noFlat = priceNaira / (1 - k);
    if (noFlat <= schedule.flatWaivedAtOrBelow) total = noFlat;
  }
  if (total - priceNaira > cap) total = capped;
  total = ceil2(total);
  // Guard against rounding: make sure the price really is left after the fee.
  let guard = 0;
  while (total - gatewayFeeOn(total, schedule, vatPercent) < priceNaira - 0.001 && guard++ < 5) total = round2(total + 0.01);
  return { totalNaira: total, feeNaira: round2(total - priceNaira) };
}

/** Everything the browser needs to show the fee before paying (it cannot read server environment variables). */
export type FeeConfig = { gateway: FeeGateway; schedule: FeeSchedule; vatPercent: number; enabled: boolean };

export function feeConfigFor(gateway: FeeGateway): FeeConfig {
  return { gateway, schedule: feeSchedule(gateway), vatPercent: envNum("GATEWAY_FEE_VAT_PERCENT", 0), enabled: customerPaysGatewayFee() };
}
