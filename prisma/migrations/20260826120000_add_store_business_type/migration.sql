-- Add the missing Store.businessType column.
-- This field has existed in prisma/schema.prisma for a while but no
-- migration was ever generated for it, so the deployed database never
-- got the column (see "Prisma error event: column Store.businessType
-- does not exist" in build/runtime logs).
--
-- businessType is set from Business.category at store-creation time
-- (see lib/actions/store.ts), so we backfill existing rows from there
-- rather than requiring a throwaway default.

-- 1. Add as nullable first so the ALTER succeeds against existing rows.
ALTER TABLE "Store" ADD COLUMN "businessType" TEXT;

-- 2. Backfill from the linked Business.category.
UPDATE "Store" s
SET "businessType" = b."category"
FROM "Business" b
WHERE b."id" = s."businessId";

-- 3. Now that every row has a value, enforce NOT NULL to match schema.prisma.
ALTER TABLE "Store" ALTER COLUMN "businessType" SET NOT NULL;
