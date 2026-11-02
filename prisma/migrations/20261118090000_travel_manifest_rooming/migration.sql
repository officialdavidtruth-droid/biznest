-- BizNest Travel: group manifest and rooming list. Additive only (nullable columns).
ALTER TABLE "TravelTraveler" ADD COLUMN "gender" TEXT;
ALTER TABLE "TravelTraveler" ADD COLUMN "roomType" TEXT;
ALTER TABLE "TravelTraveler" ADD COLUMN "roomLabel" TEXT;
ALTER TABLE "TravelTraveler" ADD COLUMN "requests" TEXT;
