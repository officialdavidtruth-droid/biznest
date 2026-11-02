-- BizNest Travel online payments: additive (nullable column, defaulted column, indexes).
ALTER TABLE "Payment" ADD COLUMN "travelTripId" TEXT;
ALTER TABLE "TravelPackage" ADD COLUMN "depositPercent" INTEGER NOT NULL DEFAULT 30;
CREATE INDEX "Payment_travelTripId_idx" ON "Payment"("travelTripId");
CREATE UNIQUE INDEX "TravelPayment_tripId_reference_key" ON "TravelPayment"("tripId", "reference");
ALTER TABLE "Payment" ADD CONSTRAINT "Payment_travelTripId_fkey" FOREIGN KEY ("travelTripId") REFERENCES "TravelTrip"("id") ON DELETE SET NULL ON UPDATE CASCADE;
