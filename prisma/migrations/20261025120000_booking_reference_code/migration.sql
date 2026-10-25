-- Short, human-friendly booking code (7 alphanumeric characters) shown to
-- guests after payment and entered by staff to verify a reservation.
-- Nullable on purpose: bookings made before this migration keep working with
-- their original booking ID, and only NEW bookings receive a code.
ALTER TABLE "Booking" ADD COLUMN IF NOT EXISTS "referenceCode" TEXT;
CREATE UNIQUE INDEX IF NOT EXISTS "Booking_referenceCode_key" ON "Booking"("referenceCode");
