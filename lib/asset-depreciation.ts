import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";

const round2 = (n: number) => Math.round(n * 100) / 100;

export type DepreciationResult =
  | { success: true; data: { amount: number } }
  | { success: false; error: string };

/**
 * Straight-line depreciation shared by the Asset Management app and the
 * Financial Control asset register, so both behave identically.
 *
 * - Amounts are rounded to cents; the final period takes whatever remains so
 *   an asset lands exactly on its residual value instead of 1-2 cents short.
 * - The write is optimistic-locked on the accumulated figure, so a double
 *   click or two staff members depreciating at once can't record the same
 *   month twice (the old read-then-increment could overshoot).
 */
export async function applyStraightLineDepreciation(storeId: string, assetId: string, months: number, maxMonths: number): Promise<DepreciationResult> {
  if (!Number.isInteger(months) || months <= 0 || months > maxMonths) return { success: false, error: `Choose between 1 and ${maxMonths} months.` };

  for (let attempt = 0; attempt < 4; attempt++) {
    const asset = await prisma.financialAsset.findFirst({ where: { id: assetId, storeId, status: "ACTIVE" } });
    if (!asset) return { success: false, error: "Asset not found or no longer active." };

    const depreciable = Number(asset.purchaseCost) - Number(asset.residualValue);
    const accumulated = Number(asset.accumulatedDepreciation);
    const remaining = round2(depreciable - accumulated);
    if (remaining <= 0) return { success: false, error: "This asset is already fully depreciated." };

    const monthly = depreciable / asset.usefulLifeMonths;
    const recordedMonths = monthly > 0 ? Math.round(accumulated / monthly) : 0;
    const reachesEnd = recordedMonths + months >= asset.usefulLifeMonths;
    const amount = reachesEnd ? remaining : Math.min(remaining, round2(monthly * months));
    const fully = reachesEnd || round2(remaining - amount) <= 0;

    const updated = await prisma.financialAsset.updateMany({
      where: { id: asset.id, storeId, status: "ACTIVE", accumulatedDepreciation: asset.accumulatedDepreciation },
      data: { accumulatedDepreciation: new Prisma.Decimal(accumulated).plus(amount).toDecimalPlaces(2), status: fully ? "FULLY_DEPRECIATED" : "ACTIVE" },
    });
    if (updated.count === 1) {
      await prisma.auditLog
        .create({ data: { action: "FINANCIAL_ASSET_DEPRECIATED", entity: "FinancialAsset", entityId: asset.id, metadata: { storeId, amount, months } } })
        .catch(() => {});
      return { success: true, data: { amount } };
    }
    // Someone else changed this asset between our read and write — re-read and retry.
  }
  return { success: false, error: "This asset was just updated elsewhere. Refresh and try again." };
}
