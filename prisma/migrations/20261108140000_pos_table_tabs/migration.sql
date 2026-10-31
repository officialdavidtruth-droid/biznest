-- POS table tabs: a running bill per table. Additive only (new enum, new table, one nullable column).
CREATE TYPE "PosTabStatus" AS ENUM ('OPEN', 'SETTLED');

CREATE TABLE "PosTab" (
    "id" TEXT NOT NULL,
    "storeId" TEXT NOT NULL,
    "label" TEXT NOT NULL,
    "status" "PosTabStatus" NOT NULL DEFAULT 'OPEN',
    "customerName" TEXT,
    "openedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "settledAt" TIMESTAMP(3),
    "settledTender" TEXT,
    "settledByUserId" TEXT,
    CONSTRAINT "PosTab_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "PosTab_storeId_status_idx" ON "PosTab"("storeId", "status");
-- One open tab per table, case-insensitive ("Table 5" and "table 5" are the same table).
CREATE UNIQUE INDEX "PosTab_storeId_label_open_key" ON "PosTab"("storeId", lower("label")) WHERE "status" = 'OPEN';

ALTER TABLE "PosTab" ADD CONSTRAINT "PosTab_storeId_fkey" FOREIGN KEY ("storeId") REFERENCES "Store"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "Order" ADD COLUMN "posTabId" TEXT;
CREATE INDEX "Order_posTabId_idx" ON "Order"("posTabId");
ALTER TABLE "Order" ADD CONSTRAINT "Order_posTabId_fkey" FOREIGN KEY ("posTabId") REFERENCES "PosTab"("id") ON DELETE SET NULL ON UPDATE CASCADE;
