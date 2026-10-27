/**
 * Which payment methods Korapay's checkout offers.
 *
 * Card payments in Nigeria often need an OTP that never arrives or times out, so
 * the checkout leads with bank transfer and Pay with Bank (neither needs a card
 * OTP) and keeps card as a fallback. Kora can only offer methods that are
 * enabled on the merchant account, so this narrows/orders, it never enables.
 *
 * Override with KORAPAY_CHANNELS (server) / NEXT_PUBLIC_KORAPAY_CHANNELS (in-page
 * popup), comma separated, e.g. "bank_transfer,pay_with_bank,card".
 * Pure module: safe to import from client components.
 */
export const KORAPAY_CHANNELS = ["bank_transfer", "pay_with_bank", "card", "mobile_money"] as const;
export type KorapayChannel = (typeof KORAPAY_CHANNELS)[number];

export const DEFAULT_KORAPAY_CHANNELS: KorapayChannel[] = ["bank_transfer", "pay_with_bank", "card"];

export function parseKorapayChannels(raw: string | null | undefined): KorapayChannel[] {
  if (!raw) return DEFAULT_KORAPAY_CHANNELS;
  const valid = new Set<string>(KORAPAY_CHANNELS);
  const out: KorapayChannel[] = [];
  for (const part of raw.split(",")) {
    const c = part.trim().toLowerCase();
    if (valid.has(c) && !out.includes(c as KorapayChannel)) out.push(c as KorapayChannel);
  }
  return out.length ? out : DEFAULT_KORAPAY_CHANNELS;
}
