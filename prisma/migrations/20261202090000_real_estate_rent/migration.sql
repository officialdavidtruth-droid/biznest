-- Real estate rent collection, tenant portal and maintenance. Additive only.
ALTER TYPE "PaymentPurpose" ADD VALUE IF NOT EXISTS 'RENT_PAYMENT';

ALTER TABLE "RealEstateUnit" ADD COLUMN "tenantEmail" TEXT,
  ADD COLUMN "tenantPhone" TEXT,
  ADD COLUMN "rentCycle" TEXT NOT NULL DEFAULT 'ANNUAL',
  ADD COLUMN "portalToken" TEXT;
CREATE UNIQUE INDEX "RealEstateUnit_portalToken_key" ON "RealEstateUnit"("portalToken");

CREATE TABLE "RentCharge" (
  "id" TEXT NOT NULL,
  "storeId" TEXT NOT NULL,
  "unitId" TEXT NOT NULL,
  "label" TEXT NOT NULL,
  "amount" DECIMAL(12,2) NOT NULL,
  "status" TEXT NOT NULL DEFAULT 'DUE',
  "dueDate" TIMESTAMP(3) NOT NULL,
  "paidAt" TIMESTAMP(3),
  "method" TEXT,
  "reference" TEXT,
  "receiptNo" TEXT,
  "note" TEXT,
  "reminderCount" INTEGER NOT NULL DEFAULT 0,
  "lastReminderAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "RentCharge_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "RentCharge_storeId_receiptNo_key" ON "RentCharge"("storeId", "receiptNo");
CREATE INDEX "RentCharge_storeId_status_dueDate_idx" ON "RentCharge"("storeId", "status", "dueDate");
CREATE INDEX "RentCharge_unitId_status_idx" ON "RentCharge"("unitId", "status");
ALTER TABLE "RentCharge" ADD CONSTRAINT "RentCharge_storeId_fkey" FOREIGN KEY ("storeId") REFERENCES "Store"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "RentCharge" ADD CONSTRAINT "RentCharge_unitId_fkey" FOREIGN KEY ("unitId") REFERENCES "RealEstateUnit"("id") ON DELETE CASCADE ON UPDATE CASCADE;

CREATE TABLE "MaintenanceRequest" (
  "id" TEXT NOT NULL,
  "storeId" TEXT NOT NULL,
  "unitId" TEXT NOT NULL,
  "title" TEXT NOT NULL,
  "detail" TEXT,
  "priority" TEXT NOT NULL DEFAULT 'NORMAL',
  "status" TEXT NOT NULL DEFAULT 'OPEN',
  "reportedBy" TEXT,
  "vendor" TEXT,
  "cost" DECIMAL(12,2),
  "resolvedAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "MaintenanceRequest_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "MaintenanceRequest_storeId_status_idx" ON "MaintenanceRequest"("storeId", "status");
CREATE INDEX "MaintenanceRequest_unitId_idx" ON "MaintenanceRequest"("unitId");
ALTER TABLE "MaintenanceRequest" ADD CONSTRAINT "MaintenanceRequest_storeId_fkey" FOREIGN KEY ("storeId") REFERENCES "Store"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "MaintenanceRequest" ADD CONSTRAINT "MaintenanceRequest_unitId_fkey" FOREIGN KEY ("unitId") REFERENCES "RealEstateUnit"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "Payment" ADD COLUMN "rentChargeId" TEXT;
CREATE INDEX "Payment_rentChargeId_idx" ON "Payment"("rentChargeId");
ALTER TABLE "Payment" ADD CONSTRAINT "Payment_rentChargeId_fkey" FOREIGN KEY ("rentChargeId") REFERENCES "RentCharge"("id") ON DELETE SET NULL ON UPDATE CASCADE;
