-- Delivery zone city grouping: merchants with multi-city coverage (e.g.
-- "Abuja: Gwarinpa/Wuse/Maitama...") can now group zones under a city label.
-- Nullable and purely additive — existing zones stay ungrouped until a
-- merchant sets one, and checkout/admin UI both fall back to a flat list
-- when city is null.

ALTER TABLE "DeliveryZone" ADD COLUMN "city" TEXT;
CREATE INDEX "DeliveryZone_storeId_city_idx" ON "DeliveryZone"("storeId", "city");
