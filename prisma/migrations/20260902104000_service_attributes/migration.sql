-- Adds the flexible niche-specific attributes column to Service, mirroring
-- Product.attributes. Nullable, no backfill needed.
ALTER TABLE "Service" ADD COLUMN "attributes" JSONB;
