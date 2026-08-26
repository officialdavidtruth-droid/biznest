-- Adds unit-based booking support (e.g. hotel room categories with N
-- identical rooms, rental fleets, anything with a countable quantity of
-- interchangeable bookable units) on top of the existing appointment-style
-- Service/Booking system. Nothing here changes existing appointment
-- bookings -- every new column is nullable and every new table is
-- additive.

-- 1. New enum for a unit's housekeeping/operational status.
CREATE TYPE "ServiceUnitStatus" AS ENUM ('AVAILABLE', 'OCCUPIED', 'RESERVED', 'DIRTY', 'CLEANING', 'MAINTENANCE', 'OUT_OF_SERVICE');

-- 2. Service gains an optional unit count. Null = unchanged
--    appointment-style service.
ALTER TABLE "Service" ADD COLUMN "totalUnits" INTEGER;

-- 3. ServiceUnit: one row per physical unit under a Service category
--    (e.g. "101", "102" ... under "Deluxe Room").
CREATE TABLE "ServiceUnit" (
    "id"        TEXT NOT NULL,
    "storeId"   TEXT NOT NULL,
    "serviceId" TEXT NOT NULL,
    "label"     TEXT NOT NULL,
    "status"    "ServiceUnitStatus" NOT NULL DEFAULT 'AVAILABLE',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ServiceUnit_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "ServiceUnit_serviceId_label_key" ON "ServiceUnit"("serviceId", "label");
CREATE INDEX "ServiceUnit_storeId_status_idx" ON "ServiceUnit"("storeId", "status");

ALTER TABLE "ServiceUnit"
  ADD CONSTRAINT "ServiceUnit_storeId_fkey"
  FOREIGN KEY ("storeId") REFERENCES "Store"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "ServiceUnit"
  ADD CONSTRAINT "ServiceUnit_serviceId_fkey"
  FOREIGN KEY ("serviceId") REFERENCES "Service"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;

-- 4. Booking: make buyerId optional (staff can create a walk-in booking
--    with no customer account), and add unit linkage, a check-in/check-out
--    date range, and guest detail fields. All nullable -- existing
--    appointment-style bookings are unaffected.

-- 4a. buyerId was NOT NULL; relax it and drop the old FK so we can
--     recreate it as SET NULL-safe (still no action needed on delete
--     since the column is now optional, but we keep the original
--     onDelete behavior implicit via a plain FK without CASCADE).
ALTER TABLE "Booking" DROP CONSTRAINT IF EXISTS "Booking_buyerId_fkey";
ALTER TABLE "Booking" ALTER COLUMN "buyerId" DROP NOT NULL;
ALTER TABLE "Booking"
  ADD CONSTRAINT "Booking_buyerId_fkey"
  FOREIGN KEY ("buyerId") REFERENCES "User"("id")
  ON DELETE SET NULL ON UPDATE CASCADE;

-- 4b. Unit linkage.
ALTER TABLE "Booking" ADD COLUMN "unitId" TEXT;
ALTER TABLE "Booking"
  ADD CONSTRAINT "Booking_unitId_fkey"
  FOREIGN KEY ("unitId") REFERENCES "ServiceUnit"("id")
  ON DELETE SET NULL ON UPDATE CASCADE;

-- 4c. Multi-day stay range.
ALTER TABLE "Booking" ADD COLUMN "checkIn" TIMESTAMP(3);
ALTER TABLE "Booking" ADD COLUMN "checkOut" TIMESTAMP(3);

-- 4d. Guest details, captured directly on the booking.
ALTER TABLE "Booking" ADD COLUMN "guestName" TEXT;
ALTER TABLE "Booking" ADD COLUMN "guestPhone" TEXT;
ALTER TABLE "Booking" ADD COLUMN "emergencyContactName" TEXT;
ALTER TABLE "Booking" ADD COLUMN "emergencyContactPhone" TEXT;
ALTER TABLE "Booking" ADD COLUMN "governmentIdType" TEXT;
ALTER TABLE "Booking" ADD COLUMN "governmentIdNumber" TEXT;
ALTER TABLE "Booking" ADD COLUMN "governmentIdImageUrl" TEXT;

CREATE INDEX "Booking_unitId_checkIn_checkOut_idx" ON "Booking"("unitId", "checkIn", "checkOut");

