/**
 * One-off backfill: populates Business.avgRating and Business.reviewCount
 * from existing Review rows (Review -> Store -> Business).
 *
 * Safe to run multiple times (idempotent) -- it always recomputes from
 * source Review data rather than incrementing, so re-running just
 * re-syncs the denormalized fields.
 *
 * Usage:
 *   npx tsx prisma/backfill-business-ratings.ts
 *
 * After this, keep avgRating/reviewCount in sync going forward via a
 * recompute-on-write hook wherever a Review is created/updated/deleted
 * (see lib/actions/reviews.ts) -- this script is for existing data only.
 */

import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

async function main() {
  console.log("Starting Business rating backfill...");

  const businesses = await prisma.business.findMany({
    select: {
      id: true,
      businessName: true,
      store: {
        select: {
          id: true,
          reviews: {
            select: { rating: true },
          },
        },
      },
    },
  });

  console.log(`Found ${businesses.length} businesses to process.`);

  let updated = 0;
  let skipped = 0;

  for (const business of businesses) {
    // Business.store is optional (Store?) -- a business that hasn't
    // finished onboarding may not have a store yet.
    if (!business.store) {
      skipped++;
      continue;
    }

    const ratings = business.store.reviews.map((r) => r.rating);
    const reviewCount = ratings.length;
    const avgRating =
      reviewCount > 0
        ? Math.round((ratings.reduce((sum, r) => sum + r, 0) / reviewCount) * 10) / 10
        : null;

    await prisma.business.update({
      where: { id: business.id },
      data: { avgRating, reviewCount },
    });

    updated++;
    if (updated % 100 === 0) {
      console.log(`  ...${updated} businesses updated so far`);
    }
  }

  console.log(`Done. Updated ${updated} businesses, skipped ${skipped} (no store yet).`);
}

main()
  .catch((err) => {
    console.error("Backfill failed:", err);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
