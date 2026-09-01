-- Adds the fields shown on the new "Edit Reservation" admin screen: how the
-- reservation came in, an optional niche-specific tier, priced add-ons, and
-- reminder/confirmation preferences.
ALTER TABLE "Booking" ADD COLUMN "source" TEXT;
ALTER TABLE "Booking" ADD COLUMN "reservationType" TEXT;
ALTER TABLE "Booking" ADD COLUMN "addons" JSONB;
ALTER TABLE "Booking" ADD COLUMN "reminderOffsetMinutes" INTEGER;
ALTER TABLE "Booking" ADD COLUMN "sendConfirmation" BOOLEAN NOT NULL DEFAULT true;
