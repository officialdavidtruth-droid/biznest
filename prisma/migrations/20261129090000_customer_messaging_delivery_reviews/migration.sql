-- Customer messaging opt-ins, delivery tracking on orders, and review-request tracking.
-- All additive and nullable / defaulted, so it is safe to apply to a live database.

ALTER TABLE "Store"
  ADD COLUMN "msgOrderUpdates"   BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN "msgAbandonedCart"  BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN "msgReviewRequests" BOOLEAN NOT NULL DEFAULT false;

ALTER TABLE "Order"
  ADD COLUMN "deliveryProvider"   TEXT,
  ADD COLUMN "deliveryRef"        TEXT,
  ADD COLUMN "deliveryStatus"     TEXT,
  ADD COLUMN "trackingUrl"        TEXT,
  ADD COLUMN "riderName"          TEXT,
  ADD COLUMN "riderPhone"         TEXT,
  ADD COLUMN "reviewRequestedAt"  TIMESTAMP(3);

ALTER TABLE "Booking"
  ADD COLUMN "reviewRequestedAt" TIMESTAMP(3);

-- The review-request job scans for finished work not yet asked about.
CREATE INDEX "Order_status_reviewRequestedAt_idx" ON "Order"("status", "reviewRequestedAt");
CREATE INDEX "Booking_status_reviewRequestedAt_idx" ON "Booking"("status", "reviewRequestedAt");
