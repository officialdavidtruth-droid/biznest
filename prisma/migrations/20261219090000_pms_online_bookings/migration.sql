-- PMS reservations that mirror an online (storefront) booking point back at it.
ALTER TABLE "PropertyReservation" ADD COLUMN "bookingId" TEXT;
CREATE UNIQUE INDEX "PropertyReservation_bookingId_key" ON "PropertyReservation"("bookingId");
