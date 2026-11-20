-- Online table reservations (date, time, party size) assigned to a listed table.
CREATE TABLE IF NOT EXISTS "TableReservation" (
  "id" TEXT NOT NULL,
  "storeId" TEXT NOT NULL,
  "tableId" TEXT,
  "code" TEXT NOT NULL,
  "guestName" TEXT NOT NULL,
  "phone" TEXT NOT NULL,
  "email" TEXT,
  "partySize" INTEGER NOT NULL,
  "startsAt" TIMESTAMP(3) NOT NULL,
  "endsAt" TIMESTAMP(3) NOT NULL,
  "status" TEXT NOT NULL DEFAULT 'CONFIRMED',
  "notes" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "TableReservation_pkey" PRIMARY KEY ("id")
);
CREATE INDEX IF NOT EXISTS "TableReservation_storeId_startsAt_idx" ON "TableReservation"("storeId", "startsAt");
CREATE INDEX IF NOT EXISTS "TableReservation_tableId_startsAt_idx" ON "TableReservation"("tableId", "startsAt");
ALTER TABLE "TableReservation" ADD CONSTRAINT "TableReservation_storeId_fkey" FOREIGN KEY ("storeId") REFERENCES "Store"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "TableReservation" ADD CONSTRAINT "TableReservation_tableId_fkey" FOREIGN KEY ("tableId") REFERENCES "FnbTable"("id") ON DELETE SET NULL ON UPDATE CASCADE;
