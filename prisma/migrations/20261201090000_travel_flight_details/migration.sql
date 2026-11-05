-- Structured flight details and the ticketing deadline on a travel service line (additive).
ALTER TABLE "TravelTripItem" ADD COLUMN "flightDetails" JSONB;
ALTER TABLE "TravelTripItem" ADD COLUMN "ticketingDeadline" TIMESTAMP(3);
ALTER TABLE "TravelTripItem" ADD COLUMN "ticketingAlertedAt" TIMESTAMP(3);
CREATE INDEX "TravelTripItem_ticketingDeadline_idx" ON "TravelTripItem"("ticketingDeadline");
