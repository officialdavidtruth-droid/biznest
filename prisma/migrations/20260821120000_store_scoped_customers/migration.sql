-- Store-scoped customer accounts: additive-only migration.
-- A customer signing up through Store A should not be able to sign in on
-- Store B. This table is the single source of truth for "is this user
-- actually a customer of this store" -- checked in lib/auth.ts's
-- Credentials authorize() on every store-context login.

CREATE TABLE "StoreCustomer" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "storeId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "StoreCustomer_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "StoreCustomer_userId_storeId_key" ON "StoreCustomer"("userId", "storeId");
CREATE INDEX "StoreCustomer_storeId_idx" ON "StoreCustomer"("storeId");
ALTER TABLE "StoreCustomer" ADD CONSTRAINT "StoreCustomer_userId_fkey"
  FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "StoreCustomer" ADD CONSTRAINT "StoreCustomer_storeId_fkey"
  FOREIGN KEY ("storeId") REFERENCES "Store"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Backfill: give every existing buyer a membership in every store they've
-- actually ordered from or booked with, so nobody who already has real
-- order history at a store is locked out of it by this change.
INSERT INTO "StoreCustomer" ("id", "userId", "storeId", "createdAt")
SELECT DISTINCT gen_random_uuid()::text, o."buyerId", o."storeId", CURRENT_TIMESTAMP
FROM "Order" o
ON CONFLICT ("userId", "storeId") DO NOTHING;
