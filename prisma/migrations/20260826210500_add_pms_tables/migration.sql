-- Create the PropertyManagement (PMS) tables and their enums.
-- Same drift root cause as the earlier migrations in this batch: these
-- models have existed in prisma/schema.prisma for a while but no
-- migration was ever generated for them, so the deployed database never
-- got them at all ("table public.PropertyRoom does not exist").
--
-- This is a fresh feature area with no prior rows, so tables are created
-- directly with their final NOT NULL / default constraints -- no backfill
-- needed.

-- Enums
CREATE TYPE "RoomStatus" AS ENUM ('AVAILABLE', 'OCCUPIED', 'RESERVED', 'DIRTY', 'CLEANING', 'MAINTENANCE', 'OUT_OF_SERVICE');
CREATE TYPE "GuestPresence" AS ENUM ('IN', 'OUT');
CREATE TYPE "PropertyReservationStatus" AS ENUM ('PENDING', 'CONFIRMED', 'CHECKED_IN', 'CHECKED_OUT', 'CANCELLED', 'NO_SHOW');

-- PropertyGuest
CREATE TABLE "PropertyGuest" (
    "id" TEXT NOT NULL,
    "storeId" TEXT NOT NULL,
    "fullName" TEXT NOT NULL,
    "email" TEXT,
    "phone" TEXT,
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PropertyGuest_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "PropertyGuest_storeId_idx" ON "PropertyGuest"("storeId");

ALTER TABLE "PropertyGuest"
  ADD CONSTRAINT "PropertyGuest_storeId_fkey"
  FOREIGN KEY ("storeId") REFERENCES "Store"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;

-- PropertyRoom
CREATE TABLE "PropertyRoom" (
    "id" TEXT NOT NULL,
    "storeId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "roomType" TEXT NOT NULL,
    "status" "RoomStatus" NOT NULL DEFAULT 'AVAILABLE',
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PropertyRoom_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "PropertyRoom_storeId_name_key" ON "PropertyRoom"("storeId", "name");
CREATE INDEX "PropertyRoom_storeId_status_idx" ON "PropertyRoom"("storeId", "status");

ALTER TABLE "PropertyRoom"
  ADD CONSTRAINT "PropertyRoom_storeId_fkey"
  FOREIGN KEY ("storeId") REFERENCES "Store"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;

-- PropertyReservation
CREATE TABLE "PropertyReservation" (
    "id" TEXT NOT NULL,
    "storeId" TEXT NOT NULL,
    "guestId" TEXT NOT NULL,
    "roomId" TEXT NOT NULL,
    "checkIn" TIMESTAMP(3) NOT NULL,
    "checkOut" TIMESTAMP(3) NOT NULL,
    "status" "PropertyReservationStatus" NOT NULL DEFAULT 'PENDING',
    "guestPresence" "GuestPresence" NOT NULL DEFAULT 'OUT',
    "notes" TEXT,
    "checkedInAt" TIMESTAMP(3),
    "checkedOutAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PropertyReservation_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "PropertyReservation_storeId_checkIn_checkOut_idx" ON "PropertyReservation"("storeId", "checkIn", "checkOut");
CREATE INDEX "PropertyReservation_storeId_status_idx" ON "PropertyReservation"("storeId", "status");
CREATE INDEX "PropertyReservation_roomId_checkIn_checkOut_idx" ON "PropertyReservation"("roomId", "checkIn", "checkOut");

ALTER TABLE "PropertyReservation"
  ADD CONSTRAINT "PropertyReservation_storeId_fkey"
  FOREIGN KEY ("storeId") REFERENCES "Store"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "PropertyReservation"
  ADD CONSTRAINT "PropertyReservation_guestId_fkey"
  FOREIGN KEY ("guestId") REFERENCES "PropertyGuest"("id")
  ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "PropertyReservation"
  ADD CONSTRAINT "PropertyReservation_roomId_fkey"
  FOREIGN KEY ("roomId") REFERENCES "PropertyRoom"("id")
  ON DELETE RESTRICT ON UPDATE CASCADE;
  
