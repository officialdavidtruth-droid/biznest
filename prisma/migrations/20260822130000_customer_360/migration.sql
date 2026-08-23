-- Customer 360: persistent store-scoped profiles for POS/offline customers.
CREATE TABLE "StoreCustomerProfile" (
  "id" TEXT NOT NULL,
  "storeId" TEXT NOT NULL,
  "userId" TEXT,
  "name" TEXT NOT NULL,
  "email" TEXT,
  "phone" TEXT,
  "notes" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "StoreCustomerProfile_pkey" PRIMARY KEY ("id")
);

ALTER TABLE "StoreCustomerProfile" ADD CONSTRAINT "StoreCustomerProfile_storeId_fkey"
  FOREIGN KEY ("storeId") REFERENCES "Store"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "StoreCustomerProfile" ADD CONSTRAINT "StoreCustomerProfile_userId_fkey"
  FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

CREATE INDEX "StoreCustomerProfile_storeId_createdAt_idx" ON "StoreCustomerProfile"("storeId", "createdAt");
CREATE INDEX "StoreCustomerProfile_storeId_phone_idx" ON "StoreCustomerProfile"("storeId", "phone");
CREATE INDEX "StoreCustomerProfile_storeId_email_idx" ON "StoreCustomerProfile"("storeId", "email");
CREATE INDEX "StoreCustomerProfile_userId_idx" ON "StoreCustomerProfile"("userId");

ALTER TABLE "Order" ADD COLUMN "customerProfileId" TEXT;
ALTER TABLE "Order" ADD CONSTRAINT "Order_customerProfileId_fkey"
  FOREIGN KEY ("customerProfileId") REFERENCES "StoreCustomerProfile"("id") ON DELETE SET NULL ON UPDATE CASCADE;
CREATE INDEX "Order_customerProfileId_idx" ON "Order"("customerProfileId");
