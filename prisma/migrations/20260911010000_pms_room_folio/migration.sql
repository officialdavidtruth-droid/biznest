CREATE TYPE "PropertyFolioChargeStatus" AS ENUM ('OPEN', 'PAID', 'VOID');

CREATE TABLE "PropertyFolioCharge" (
    "id" TEXT NOT NULL,
    "storeId" TEXT NOT NULL,
    "reservationId" TEXT NOT NULL,
    "guestId" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "category" TEXT,
    "quantity" INTEGER NOT NULL DEFAULT 1,
    "unitAmount" DECIMAL(12,2) NOT NULL,
    "amount" DECIMAL(12,2) NOT NULL,
    "currency" TEXT NOT NULL DEFAULT 'NGN',
    "status" "PropertyFolioChargeStatus" NOT NULL DEFAULT 'OPEN',
    "postedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "paidAt" TIMESTAMP(3),
    "voidedAt" TIMESTAMP(3),
    "notes" TEXT,
    CONSTRAINT "PropertyFolioCharge_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "PropertyFolioCharge_storeId_postedAt_idx" ON "PropertyFolioCharge"("storeId", "postedAt");
CREATE INDEX "PropertyFolioCharge_storeId_reservationId_status_idx" ON "PropertyFolioCharge"("storeId", "reservationId", "status");
CREATE INDEX "PropertyFolioCharge_storeId_guestId_postedAt_idx" ON "PropertyFolioCharge"("storeId", "guestId", "postedAt");

ALTER TABLE "PropertyFolioCharge" ADD CONSTRAINT "PropertyFolioCharge_storeId_fkey" FOREIGN KEY ("storeId") REFERENCES "Store"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "PropertyFolioCharge" ADD CONSTRAINT "PropertyFolioCharge_reservationId_fkey" FOREIGN KEY ("reservationId") REFERENCES "PropertyReservation"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "PropertyFolioCharge" ADD CONSTRAINT "PropertyFolioCharge_guestId_fkey" FOREIGN KEY ("guestId") REFERENCES "PropertyGuest"("id") ON DELETE CASCADE ON UPDATE CASCADE;
