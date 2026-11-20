-- Dedicated per-store account numbers issued by the payment gateway.
ALTER TYPE "PaymentPurpose" ADD VALUE IF NOT EXISTS 'STORE_TRANSFER';

CREATE TABLE IF NOT EXISTS "StoreVirtualAccount" (
  "id" TEXT NOT NULL,
  "storeId" TEXT NOT NULL,
  "provider" "PaymentProvider" NOT NULL,
  "accountNumber" TEXT NOT NULL,
  "bankName" TEXT NOT NULL,
  "accountName" TEXT NOT NULL,
  "reference" TEXT NOT NULL,
  "status" TEXT NOT NULL DEFAULT 'ACTIVE',
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "StoreVirtualAccount_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX IF NOT EXISTS "StoreVirtualAccount_reference_key" ON "StoreVirtualAccount"("reference");
CREATE UNIQUE INDEX IF NOT EXISTS "StoreVirtualAccount_provider_accountNumber_key" ON "StoreVirtualAccount"("provider", "accountNumber");
CREATE INDEX IF NOT EXISTS "StoreVirtualAccount_storeId_idx" ON "StoreVirtualAccount"("storeId");
ALTER TABLE "StoreVirtualAccount" ADD CONSTRAINT "StoreVirtualAccount_storeId_fkey" FOREIGN KEY ("storeId") REFERENCES "Store"("id") ON DELETE CASCADE ON UPDATE CASCADE;
