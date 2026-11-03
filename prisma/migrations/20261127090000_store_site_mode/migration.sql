-- Simple / Advanced website tooling. New and existing stores start in SIMPLE.
ALTER TABLE "Store" ADD COLUMN "siteMode" TEXT NOT NULL DEFAULT 'SIMPLE';

-- Stores that already built a custom header menu keep the tools they are using.
UPDATE "Store" SET "siteMode" = 'ADVANCED'
WHERE EXISTS (SELECT 1 FROM "StoreMenuItem" m WHERE m."storeId" = "Store"."id");
