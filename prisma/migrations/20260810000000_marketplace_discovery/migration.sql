-- Marketplace discovery: additive-only migration.
-- Adds nullable/defaulted columns to Business and Category, plus one new
-- standalone table (SearchQuery). No existing column, table, relation, or
-- constraint is altered or dropped, so existing app code paths are unaffected.

-- Business: geo + discovery fields
ALTER TABLE "Business" ADD COLUMN "latitude" DOUBLE PRECISION;
ALTER TABLE "Business" ADD COLUMN "longitude" DOUBLE PRECISION;
ALTER TABLE "Business" ADD COLUMN "searchVisible" BOOLEAN NOT NULL DEFAULT true;
ALTER TABLE "Business" ADD COLUMN "avgRating" DOUBLE PRECISION;
ALTER TABLE "Business" ADD COLUMN "reviewCount" INTEGER NOT NULL DEFAULT 0;

-- Business: new indexes to support discovery queries
CREATE INDEX "Business_category_idx" ON "Business"("category");
CREATE INDEX "Business_city_state_idx" ON "Business"("city", "state");
CREATE INDEX "Business_latitude_longitude_idx" ON "Business"("latitude", "longitude");

-- Category: per-vertical filter definitions for the discovery UI
ALTER TABLE "Category" ADD COLUMN "filterSchema" JSONB;

-- New standalone table: logged marketplace searches (no FK to existing tables)
CREATE TABLE "SearchQuery" (
    "id" TEXT NOT NULL,
    "rawQuery" TEXT,
    "category" TEXT,
    "city" TEXT,
    "state" TEXT,
    "resultCount" INTEGER NOT NULL,
    "clickedBusinessId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "SearchQuery_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "SearchQuery_category_city_idx" ON "SearchQuery"("category", "city");
CREATE INDEX "SearchQuery_createdAt_idx" ON "SearchQuery"("createdAt");
