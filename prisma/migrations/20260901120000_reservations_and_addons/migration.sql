-- Reservation fields (generic across any unit-based booking niche)
ALTER TYPE "BookingStatus" ADD VALUE IF NOT EXISTS 'CHECKED_IN';
ALTER TYPE "BookingStatus" ADD VALUE IF NOT EXISTS 'SEATED';
ALTER TYPE "BookingStatus" ADD VALUE IF NOT EXISTS 'NO_SHOW';

ALTER TABLE "Booking" ADD COLUMN IF NOT EXISTS "partySize" INTEGER;
ALTER TABLE "Booking" ADD COLUMN IF NOT EXISTS "specialRequests" TEXT[] NOT NULL DEFAULT '{}';

ALTER TABLE "ServiceUnit" ADD COLUMN IF NOT EXISTS "location" TEXT;
ALTER TABLE "ServiceUnit" ADD COLUMN IF NOT EXISTS "capacity" INTEGER;

-- Product add-ons / extras
CREATE TABLE IF NOT EXISTS "ProductAddonGroup" (
    "id" TEXT NOT NULL,
    "productId" TEXT NOT NULL,
    "storeId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "minSelect" INTEGER NOT NULL DEFAULT 0,
    "maxSelect" INTEGER,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "ProductAddonGroup_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "ProductAddon" (
    "id" TEXT NOT NULL,
    "groupId" TEXT NOT NULL,
    "storeId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "price" DECIMAL(12,2) NOT NULL DEFAULT 0,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "ProductAddon_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "ProductAddonGroup_productId_idx" ON "ProductAddonGroup"("productId");
CREATE INDEX IF NOT EXISTS "ProductAddonGroup_storeId_idx" ON "ProductAddonGroup"("storeId");
CREATE INDEX IF NOT EXISTS "ProductAddon_groupId_idx" ON "ProductAddon"("groupId");
CREATE INDEX IF NOT EXISTS "ProductAddon_storeId_idx" ON "ProductAddon"("storeId");

DO $$ BEGIN
  ALTER TABLE "ProductAddonGroup" ADD CONSTRAINT "ProductAddonGroup_productId_fkey" FOREIGN KEY ("productId") REFERENCES "Product"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  ALTER TABLE "ProductAddonGroup" ADD CONSTRAINT "ProductAddonGroup_storeId_fkey" FOREIGN KEY ("storeId") REFERENCES "Store"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  ALTER TABLE "ProductAddon" ADD CONSTRAINT "ProductAddon_groupId_fkey" FOREIGN KEY ("groupId") REFERENCES "ProductAddonGroup"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  ALTER TABLE "ProductAddon" ADD CONSTRAINT "ProductAddon_storeId_fkey" FOREIGN KEY ("storeId") REFERENCES "Store"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
