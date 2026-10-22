/**
 * Paystack's `channels` parameter on /transaction/initialize is an allow-list:
 * it can only NARROW what the hosted checkout shows. A channel that isn't
 * enabled on the Paystack account (or isn't supported for the currency) will
 * not appear no matter what is passed here, so this is a way to be explicit
 * and to diagnose, not a way to switch a channel on.
 */
export const PAYSTACK_CHANNELS = ["card", "bank", "ussd", "qr", "mobile_money", "bank_transfer", "apple_pay"] as const;
export type PaystackChannel = (typeof PAYSTACK_CHANNELS)[number];

/** Everything Paystack can show for NGN. */
export const NGN_ALL_CHANNELS: PaystackChannel[] = ["card", "bank", "ussd", "qr", "bank_transfer", "apple_pay"];

/**
 * Parses a comma-separated list (e.g. the PAYSTACK_CHANNELS env var). Unknown
 * values are dropped, duplicates removed. Returns undefined when nothing valid
 * is left, so the caller sends no `channels` field and Paystack falls back to
 * the dashboard settings exactly as before.
 */
export function parsePaystackChannels(raw: string | null | undefined): PaystackChannel[] | undefined {
  if (!raw) return undefined;
  const valid = new Set<string>(PAYSTACK_CHANNELS);
  const out: PaystackChannel[] = [];
  for (const part of raw.split(",")) {
    const c = part.trim().toLowerCase();
    if (valid.has(c) && !out.includes(c as PaystackChannel)) out.push(c as PaystackChannel);
  }
  return out.length ? out : undefined;
}
