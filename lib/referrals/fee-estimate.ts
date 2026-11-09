/** Standard NGN bank-transfer fee tiers (what the gateway charges per transfer). Pure, so pages can show an estimate. */
export function estimateReferralTransferFee(amountNaira: number): number {
  if (amountNaira <= 5000) return 10;
  if (amountNaira <= 50000) return 25;
  return 50;
}
