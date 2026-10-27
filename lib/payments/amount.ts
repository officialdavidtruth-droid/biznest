/**
 * Does what the gateway says it collected cover what we asked for?
 *
 * Gateways can collect MORE than the requested amount: Paystack adds its fee
 * on top for bank transfer when the customer bears fees (requested 118.00,
 * collected 119.80), and the verify call reports the collected total. That is
 * not a problem — the order/booking/invoice is credited at its own price.
 * Collecting LESS is the real risk (underpayment), so only that is refused.
 */
export function amountCoversExpected(paidNaira: number, expectedNaira: number): boolean {
  if (!Number.isFinite(paidNaira) || !Number.isFinite(expectedNaira)) return false;
  return paidNaira >= expectedNaira - 0.01;
}
