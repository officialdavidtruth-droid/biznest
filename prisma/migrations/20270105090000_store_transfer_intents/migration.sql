-- Orders waiting for a bank transfer into a store's dedicated account (matched by a unique amount).
CREATE TABLE IF NOT EXISTS "StoreTransferIntent" (
  "id" TEXT NOT NULL,
  "storeId" TEXT NOT NULL,
  "orderId" TEXT NOT NULL,
  "virtualAccountId" TEXT NOT NULL,
  "amount" DECIMAL(14,2) NOT NULL,
  "status" TEXT NOT NULL DEFAULT 'OPEN',
  "gatewayReference" TEXT,
  "expiresAt" TIMESTAMP(3) NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "StoreTransferIntent_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX IF NOT EXISTS "StoreTransferIntent_orderId_key" ON "StoreTransferIntent"("orderId");
CREATE INDEX IF NOT EXISTS "StoreTransferIntent_storeId_status_amount_idx" ON "StoreTransferIntent"("storeId", "status", "amount");
ALTER TABLE "StoreTransferIntent" ADD CONSTRAINT "StoreTransferIntent_storeId_fkey" FOREIGN KEY ("storeId") REFERENCES "Store"("id") ON DELETE CASCADE ON UPDATE CASCADE;
