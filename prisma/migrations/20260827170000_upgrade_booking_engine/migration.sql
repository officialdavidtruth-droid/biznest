CREATE TABLE "ServiceStaff" (
  "id" TEXT NOT NULL,
  "serviceId" TEXT NOT NULL,
  "staffId" TEXT NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "ServiceStaff_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "ServiceStaff_serviceId_staffId_key" ON "ServiceStaff"("serviceId", "staffId");
CREATE INDEX "ServiceStaff_staffId_idx" ON "ServiceStaff"("staffId");
ALTER TABLE "ServiceStaff" ADD CONSTRAINT "ServiceStaff_serviceId_fkey" FOREIGN KEY ("serviceId") REFERENCES "Service"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "ServiceStaff" ADD CONSTRAINT "ServiceStaff_staffId_fkey" FOREIGN KEY ("staffId") REFERENCES "StoreStaff"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "Booking" ADD COLUMN "staffId" TEXT;
CREATE INDEX "Booking_staffId_scheduledAt_idx" ON "Booking"("staffId", "scheduledAt");
ALTER TABLE "Booking" ADD CONSTRAINT "Booking_staffId_fkey" FOREIGN KEY ("staffId") REFERENCES "StoreStaff"("id") ON DELETE SET NULL ON UPDATE CASCADE;
