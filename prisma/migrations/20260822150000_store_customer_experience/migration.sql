-- Store customer experience: dedicated per-store address/loyalty records and
-- an explicit store boundary on conversations. Existing legacy records remain
-- intact and are not exposed through the new store-scoped customer routes.
CREATE TABLE "StoreCustomerAddress" (
  "id" TEXT NOT NULL,
  "storeId" TEXT NOT NULL,
  "userId" TEXT NOT NULL,
  "label" TEXT,
  "fullName" TEXT NOT NULL,
  "phone" TEXT NOT NULL,
  "line1" TEXT NOT NULL,
  "line2" TEXT,
  "city" TEXT NOT NULL,
  "state" TEXT NOT NULL,
  "country" TEXT NOT NULL DEFAULT 'Nigeria',
  "isDefault" BOOLEAN NOT NULL DEFAULT false,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "StoreCustomerAddress_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "StoreCustomerAddress_storeId_userId_idx" ON "StoreCustomerAddress"("storeId", "userId");
CREATE INDEX "StoreCustomerAddress_storeId_userId_isDefault_idx" ON "StoreCustomerAddress"("storeId", "userId", "isDefault");
ALTER TABLE "StoreCustomerAddress" ADD CONSTRAINT "StoreCustomerAddress_storeId_fkey" FOREIGN KEY ("storeId") REFERENCES "Store"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "StoreCustomerAddress" ADD CONSTRAINT "StoreCustomerAddress_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

CREATE TABLE "StoreLoyaltyAccount" (
  "id" TEXT NOT NULL,
  "storeId" TEXT NOT NULL,
  "userId" TEXT NOT NULL,
  "pointsBalance" INTEGER NOT NULL DEFAULT 0,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "StoreLoyaltyAccount_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "StoreLoyaltyAccount_storeId_userId_key" ON "StoreLoyaltyAccount"("storeId", "userId");
CREATE INDEX "StoreLoyaltyAccount_storeId_idx" ON "StoreLoyaltyAccount"("storeId");
ALTER TABLE "StoreLoyaltyAccount" ADD CONSTRAINT "StoreLoyaltyAccount_storeId_fkey" FOREIGN KEY ("storeId") REFERENCES "Store"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "StoreLoyaltyAccount" ADD CONSTRAINT "StoreLoyaltyAccount_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

CREATE TABLE "StoreLoyaltyEntry" (
  "id" TEXT NOT NULL,
  "loyaltyAccountId" TEXT NOT NULL,
  "orderId" TEXT,
  "type" "LoyaltyEntryType" NOT NULL,
  "points" INTEGER NOT NULL,
  "note" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "StoreLoyaltyEntry_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "StoreLoyaltyEntry_loyaltyAccountId_createdAt_idx" ON "StoreLoyaltyEntry"("loyaltyAccountId", "createdAt");
CREATE INDEX "StoreLoyaltyEntry_orderId_type_idx" ON "StoreLoyaltyEntry"("orderId", "type");
ALTER TABLE "StoreLoyaltyEntry" ADD CONSTRAINT "StoreLoyaltyEntry_loyaltyAccountId_fkey" FOREIGN KEY ("loyaltyAccountId") REFERENCES "StoreLoyaltyAccount"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "StoreLoyaltyEntry" ADD CONSTRAINT "StoreLoyaltyEntry_orderId_fkey" FOREIGN KEY ("orderId") REFERENCES "Order"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "Conversation" ADD COLUMN "storeId" TEXT;
CREATE INDEX "Conversation_storeId_idx" ON "Conversation"("storeId");
ALTER TABLE "Conversation" ADD CONSTRAINT "Conversation_storeId_fkey" FOREIGN KEY ("storeId") REFERENCES "Store"("id") ON DELETE CASCADE ON UPDATE CASCADE;
