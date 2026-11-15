import "server-only";

import { prisma } from "@/lib/prisma";
import { getLoyaltyRates, type LoyaltyRates } from "@/lib/actions/site-settings";

/** A store's own earn/cash-out rates, falling back to the platform rates for any it has not set. */
export async function getStoreLoyaltyRates(storeId: string): Promise<LoyaltyRates & { custom: boolean }> {
  const [platform, store] = await Promise.all([
    getLoyaltyRates(),
    prisma.store.findUnique({ where: { id: storeId }, select: { loyaltyPointsPerNaira: true, loyaltyNairaPerPoint: true } }),
  ]);
  const earn = store?.loyaltyPointsPerNaira != null ? Number(store.loyaltyPointsPerNaira) : null;
  const redeem = store?.loyaltyNairaPerPoint != null ? Number(store.loyaltyNairaPerPoint) : null;
  return {
    pointsPerNaira: earn ?? platform.pointsPerNaira,
    nairaPerPoint: redeem ?? platform.nairaPerPoint,
    custom: earn != null || redeem != null,
  };
}
