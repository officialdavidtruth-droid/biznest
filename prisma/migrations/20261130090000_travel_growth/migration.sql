-- BizNest Travel: shareable proposals with acceptance, instalment reminders, per-date departures,
-- multi-currency supplier costs, agency settings (terms, reminders, partner key).
-- Additive only: every new column is nullable or defaulted, so it is safe on a live database.

CREATE TABLE "TravelDeparture" (
  "id" TEXT NOT NULL,
  "storeId" TEXT NOT NULL,
  "packageId" TEXT NOT NULL,
  "departureDate" TIMESTAMP(3) NOT NULL,
  "seats" INTEGER NOT NULL DEFAULT 0,
  "cutoffDays" INTEGER NOT NULL DEFAULT 0,
  "pricePerPerson" DECIMAL(12,2),
  "isActive" BOOLEAN NOT NULL DEFAULT true,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "TravelDeparture_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "TravelDeparture_packageId_departureDate_idx" ON "TravelDeparture"("packageId", "departureDate");
CREATE INDEX "TravelDeparture_storeId_departureDate_idx" ON "TravelDeparture"("storeId", "departureDate");
ALTER TABLE "TravelDeparture" ADD CONSTRAINT "TravelDeparture_storeId_fkey" FOREIGN KEY ("storeId") REFERENCES "Store"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "TravelDeparture" ADD CONSTRAINT "TravelDeparture_packageId_fkey" FOREIGN KEY ("packageId") REFERENCES "TravelPackage"("id") ON DELETE CASCADE ON UPDATE CASCADE;

CREATE TABLE "TravelSettings" (
  "storeId" TEXT NOT NULL,
  "termsText" TEXT,
  "remindersEnabled" BOOLEAN NOT NULL DEFAULT true,
  "reviewUrl" TEXT,
  "partnerKeyHash" TEXT,
  "partnerKeyHint" TEXT,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "TravelSettings_pkey" PRIMARY KEY ("storeId")
);
ALTER TABLE "TravelSettings" ADD CONSTRAINT "TravelSettings_storeId_fkey" FOREIGN KEY ("storeId") REFERENCES "Store"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "TravelTrip"
  ADD COLUMN "departureId" TEXT,
  ADD COLUMN "shareToken" TEXT,
  ADD COLUMN "proposalNote" TEXT,
  ADD COLUMN "proposalValidUntil" TIMESTAMP(3),
  ADD COLUMN "proposalSentAt" TIMESTAMP(3),
  ADD COLUMN "termsText" TEXT,
  ADD COLUMN "acceptedAt" TIMESTAMP(3),
  ADD COLUMN "acceptedName" TEXT,
  ADD COLUMN "acceptedIp" TEXT,
  ADD COLUMN "reviewRequestedAt" TIMESTAMP(3);
CREATE UNIQUE INDEX "TravelTrip_shareToken_key" ON "TravelTrip"("shareToken");
CREATE INDEX "TravelTrip_departureId_idx" ON "TravelTrip"("departureId");
ALTER TABLE "TravelTrip" ADD CONSTRAINT "TravelTrip_departureId_fkey" FOREIGN KEY ("departureId") REFERENCES "TravelDeparture"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "TravelPayment"
  ADD COLUMN "reminderCount" INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN "lastReminderAt" TIMESTAMP(3);

ALTER TABLE "TravelTripItem"
  ADD COLUMN "costCurrency" TEXT,
  ADD COLUMN "costAmount" DECIMAL(14,2),
  ADD COLUMN "fxRate" DECIMAL(16,6);
