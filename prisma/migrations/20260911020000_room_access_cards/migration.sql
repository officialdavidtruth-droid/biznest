CREATE TYPE "RoomCardStatus" AS ENUM ('ACTIVE', 'REVOKED');

CREATE TABLE "RoomAccessCard" (
  "id" TEXT NOT NULL,
  "storeId" TEXT NOT NULL,
  "roomId" TEXT NOT NULL,
  "reservationId" TEXT,
  "guestId" TEXT,
  "cardUid" TEXT NOT NULL,
  "label" TEXT,
  "status" "RoomCardStatus" NOT NULL DEFAULT 'ACTIVE',
  "activatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "expiresAt" TIMESTAMP(3),
  "revokedAt" TIMESTAMP(3),
  "revokedReason" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "RoomAccessCard_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "RoomAccessCard_storeId_cardUid_key" ON "RoomAccessCard"("storeId", "cardUid");
CREATE INDEX "RoomAccessCard_storeId_roomId_status_idx" ON "RoomAccessCard"("storeId", "roomId", "status");
CREATE INDEX "RoomAccessCard_reservationId_status_idx" ON "RoomAccessCard"("reservationId", "status");
CREATE INDEX "RoomAccessCard_guestId_status_idx" ON "RoomAccessCard"("guestId", "status");
CREATE INDEX "RoomAccessCard_expiresAt_status_idx" ON "RoomAccessCard"("expiresAt", "status");

ALTER TABLE "RoomAccessCard" ADD CONSTRAINT "RoomAccessCard_storeId_fkey" FOREIGN KEY ("storeId") REFERENCES "Store"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "RoomAccessCard" ADD CONSTRAINT "RoomAccessCard_roomId_fkey" FOREIGN KEY ("roomId") REFERENCES "PropertyRoom"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "RoomAccessCard" ADD CONSTRAINT "RoomAccessCard_reservationId_fkey" FOREIGN KEY ("reservationId") REFERENCES "PropertyReservation"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "RoomAccessCard" ADD CONSTRAINT "RoomAccessCard_guestId_fkey" FOREIGN KEY ("guestId") REFERENCES "PropertyGuest"("id") ON DELETE SET NULL ON UPDATE CASCADE;
