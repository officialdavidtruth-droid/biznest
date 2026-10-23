-- Link a PMS room to the online-booking unit that is the same physical room,
-- so availability is shared in both directions. Optional and one-to-one.
ALTER TABLE "PropertyRoom" ADD COLUMN "serviceUnitId" TEXT;

CREATE UNIQUE INDEX "PropertyRoom_serviceUnitId_key" ON "PropertyRoom"("serviceUnitId");

ALTER TABLE "PropertyRoom" ADD CONSTRAINT "PropertyRoom_serviceUnitId_fkey"
  FOREIGN KEY ("serviceUnitId") REFERENCES "ServiceUnit"("id") ON DELETE SET NULL ON UPDATE CASCADE;
