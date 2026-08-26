-- Add every remaining Category column that may be missing from the
-- deployed database, following the same drift pattern as storeId before
-- it: fields present in prisma/schema.prisma with no matching migration.
--
-- Using IF NOT EXISTS on each column so this is safe to run even if some
-- of these already exist -- it only fills genuine gaps.
--
-- All four are nullable or have a default, so no backfill is required
-- and no NOT NULL is being newly enforced here.

ALTER TABLE "Category" ADD COLUMN IF NOT EXISTS "sortOrder" INTEGER NOT NULL DEFAULT 0;
ALTER TABLE "Category" ADD COLUMN IF NOT EXISTS "isActive" BOOLEAN NOT NULL DEFAULT true;
ALTER TABLE "Category" ADD COLUMN IF NOT EXISTS "imageUrl" TEXT;
ALTER TABLE "Category" ADD COLUMN IF NOT EXISTS "icon" TEXT;
