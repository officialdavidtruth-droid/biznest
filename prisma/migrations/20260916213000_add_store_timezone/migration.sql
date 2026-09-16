ALTER TABLE "Store" ADD COLUMN "timezone" TEXT NOT NULL DEFAULT 'Africa/Lagos';
UPDATE "Store" AS s SET "businessType"=b."category" FROM "Business" AS b WHERE s."businessId"=b."id" AND s."businessType" IS DISTINCT FROM b."category";
