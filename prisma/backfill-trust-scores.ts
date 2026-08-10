/**
 * Backfill / nightly sweep: populates Business.trustScore and
 * Business.trustScoreUpdatedAt by running the full live computation
 * (getTrustScoreBreakdown, lib/actions/trust-score.ts) and persisting
 * just the final score.
 *
 * Safe to run multiple times (idempotent) -- always recomputes from
 * source data rather than incrementing.
 *
 * Two jobs in one script:
 *  1. One-off backfill for existing rows the first time this column
 *     ships (every Business currently has trustScore = null).
 *  2. Ongoing nightly sweep to catch the factors that don't have a
 *     write-hook: accountAgeFactor drifts every day by construction,
 *     and responseTimeFactor can drift from message activity that
 *     recomputeAndPersistTrustScore() isn't called on (see the comment
 *     above that function for why). Everything else (order status,
 *     dispute resolution, verification decisions) is already kept live
 *     by write-hooks -- this sweep just re-syncs the slow-moving rest.
 *
 * Usage:
 *   npx tsx prisma/backfill-trust-scores.ts
 *
 * Suggested schedule: nightly cron, same cadence as any other
 * denormalized-field sweep in this codebase.
 */

import { PrismaClient } from "@prisma/client";
import { getTrustScoreBreakdown } from "@/lib/actions/trust-score";

const prisma = new PrismaClient();

async function main() {
  console.log("Starting Business trust score backfill/sweep...");

  const businesses = await prisma.business.findMany({ select: { id: true } });
  console.log(`Found ${businesses.length} businesses to process.`);

  let updated = 0;
  let skipped = 0;

  for (const { id } of businesses) {
    const breakdown = await getTrustScoreBreakdown(id);
    if (!breakdown) {
      skipped++;
      continue;
    }

    await prisma.business.update({
      where: { id },
      data: { trustScore: breakdown.score, trustScoreUpdatedAt: new Date() },
    });

    updated++;
    if (updated % 100 === 0) {
      console.log(`  ...${updated} businesses updated so far`);
    }
  }

  console.log(`Done. Updated ${updated} businesses, skipped ${skipped}.`);
}

main()
  .catch((err) => {
    console.error("Trust score backfill failed:", err);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
