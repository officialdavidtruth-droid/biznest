import "server-only";
import { getFlutterwaveTransferFeeNaira } from "@/lib/payments/flutterwave";
import { transferFeeNaira } from "@/lib/payments/gateway-fee";
import { estimateReferralTransferFee } from "@/lib/referrals/fee-estimate";

/**
 * The gateway's transfer fee for a reward withdrawal. It is always taken out of the vendor's reward,
 * never from BizNest's balance. Flutterwave is asked for its exact fee; if that can't be read (or for
 * Korapay) the standard NGN tiers are used. PAYOUT_TRANSFER_FEE_NAIRA, when set, overrides both.
 */
export async function resolveReferralTransferFee(gateway: "FLUTTERWAVE" | "KORAPAY", amountNaira: number): Promise<number> {
  const override = transferFeeNaira();
  if (override > 0) return override;
  if (gateway === "FLUTTERWAVE") {
    try {
      const live = await getFlutterwaveTransferFeeNaira(amountNaira);
      if (live !== null) return live;
    } catch {
      /* fall back to the tiers */
    }
  }
  return estimateReferralTransferFee(amountNaira);
}
