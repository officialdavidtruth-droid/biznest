-- FnB operator shifts: every register sale can be reconciled to the staff
-- member's open/closed shift and its start/end timestamps.
CREATE TYPE "FnbShiftStatus" AS ENUM ('OPEN', 'CLOSED');

CREATE TABLE "FnbShift" (
  "id" TEXT NOT NULL,
  "storeId" TEXT NOT NULL,
  "staffUserId" TEXT NOT NULL,
  "status" "FnbShiftStatus" NOT NULL DEFAULT 'OPEN',
  "startedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "endedAt" TIMESTAMP(3),
  "salesCount" INTEGER NOT NULL DEFAULT 0,
  "salesTotal" DECIMAL(12,2) NOT NULL DEFAULT 0,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "FnbShift_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "FnbShift_storeId_fkey" FOREIGN KEY ("storeId") REFERENCES "Store"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "FnbShift_staffUserId_fkey" FOREIGN KEY ("staffUserId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE INDEX "FnbShift_storeId_staffUserId_startedAt_idx" ON "FnbShift"("storeId", "staffUserId", "startedAt");
CREATE INDEX "FnbShift_storeId_status_idx" ON "FnbShift"("storeId", "status");
CREATE UNIQUE INDEX "FnbShift_one_open_per_staff_idx" ON "FnbShift"("storeId", "staffUserId") WHERE "status" = 'OPEN';

ALTER TABLE "Order" ADD COLUMN "fnbShiftId" TEXT;
CREATE INDEX "Order_fnbShiftId_idx" ON "Order"("fnbShiftId");
ALTER TABLE "Order" ADD CONSTRAINT "Order_fnbShiftId_fkey" FOREIGN KEY ("fnbShiftId") REFERENCES "FnbShift"("id") ON DELETE SET NULL ON UPDATE CASCADE;
