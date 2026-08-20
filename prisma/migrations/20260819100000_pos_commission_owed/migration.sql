-- POS commission tracking. A POS (cash/in-person) sale never touches an
-- online gateway, so there's nothing for the platform to auto-split at
-- charge time the way it does for online orders (see the "Sales
-- automatically split" copy on the Payments page). Instead, commission on
-- each POS sale accrues to Store.posCommissionOwed and is cleared later via
-- a recorded settlement -- see lib/actions/pos.ts.

-- AlterTable
ALTER TABLE "Store" ADD COLUMN "posCommissionOwed" DECIMAL(12,2) NOT NULL DEFAULT 0;

-- CreateTable
CREATE TABLE "PosCommissionSettlement" (
    "id" TEXT NOT NULL,
    "storeId" TEXT NOT NULL,
    "amount" DECIMAL(12,2) NOT NULL,
    "note" TEXT,
    "settledByEmail" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PosCommissionSettlement_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "PosCommissionSettlement_storeId_createdAt_idx" ON "PosCommissionSettlement"("storeId", "createdAt");

ALTER TABLE "PosCommissionSettlement" ADD CONSTRAINT "PosCommissionSettlement_storeId_fkey"
  FOREIGN KEY ("storeId") REFERENCES "Store"("id") ON DELETE CASCADE ON UPDATE CASCADE;
