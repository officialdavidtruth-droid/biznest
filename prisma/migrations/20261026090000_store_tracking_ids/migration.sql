-- Per-store analytics / ad-conversion tracking IDs (GA4, Meta Pixel, Plausible).
-- Nullable, no backfill: a store with all three NULL loads no third-party scripts.
ALTER TABLE "Store"
  ADD COLUMN "trackingGaId" TEXT,
  ADD COLUMN "trackingMetaPixelId" TEXT,
  ADD COLUMN "trackingPlausibleDomain" TEXT;
