-- BizNest Travel: day-by-day itinerary builder. Additive only.
CREATE TABLE "TravelItineraryDay" (
    "id" TEXT NOT NULL,
    "tripId" TEXT NOT NULL,
    "dayNumber" INTEGER NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "TravelItineraryDay_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "TravelItineraryDay_tripId_dayNumber_key" ON "TravelItineraryDay"("tripId", "dayNumber");
CREATE INDEX "TravelItineraryDay_tripId_idx" ON "TravelItineraryDay"("tripId");
ALTER TABLE "TravelItineraryDay" ADD CONSTRAINT "TravelItineraryDay_tripId_fkey" FOREIGN KEY ("tripId") REFERENCES "TravelTrip"("id") ON DELETE CASCADE ON UPDATE CASCADE;
