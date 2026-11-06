-- Logistics dispatch. Additive only.
CREATE TABLE "Rider" (
  "id" TEXT NOT NULL, "storeId" TEXT NOT NULL, "name" TEXT NOT NULL, "phone" TEXT, "vehicle" TEXT, "active" BOOLEAN NOT NULL DEFAULT true,
  "accessToken" TEXT NOT NULL, "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "Rider_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "Rider_accessToken_key" ON "Rider"("accessToken");
CREATE INDEX "Rider_storeId_active_idx" ON "Rider"("storeId", "active");

CREATE TABLE "Delivery" (
  "id" TEXT NOT NULL, "storeId" TEXT NOT NULL, "jobNo" TEXT NOT NULL, "riderId" TEXT, "customerName" TEXT NOT NULL, "customerPhone" TEXT, "customerEmail" TEXT,
  "pickupAddress" TEXT NOT NULL, "pickupContact" TEXT, "dropoffAddress" TEXT NOT NULL, "dropoffContact" TEXT, "itemDescription" TEXT,
  "fee" DECIMAL(12,2) NOT NULL DEFAULT 0, "feePaid" BOOLEAN NOT NULL DEFAULT false, "codAmount" DECIMAL(12,2) NOT NULL DEFAULT 0, "codRemittedAt" TIMESTAMP(3),
  "status" TEXT NOT NULL DEFAULT 'NEW', "trackToken" TEXT NOT NULL, "deliveryPin" TEXT NOT NULL, "recipientName" TEXT, "failureReason" TEXT,
  "assignedAt" TIMESTAMP(3), "pickedUpAt" TIMESTAMP(3), "deliveredAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP, "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "Delivery_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "Delivery_trackToken_key" ON "Delivery"("trackToken");
CREATE UNIQUE INDEX "Delivery_storeId_jobNo_key" ON "Delivery"("storeId", "jobNo");
CREATE INDEX "Delivery_storeId_status_createdAt_idx" ON "Delivery"("storeId", "status", "createdAt");
CREATE INDEX "Delivery_riderId_status_idx" ON "Delivery"("riderId", "status");

CREATE TABLE "DeliveryEvent" (
  "id" TEXT NOT NULL, "deliveryId" TEXT NOT NULL, "status" TEXT NOT NULL, "note" TEXT, "at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "DeliveryEvent_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "DeliveryEvent_deliveryId_at_idx" ON "DeliveryEvent"("deliveryId", "at");

ALTER TABLE "Rider" ADD CONSTRAINT "Rider_storeId_fkey" FOREIGN KEY ("storeId") REFERENCES "Store"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "Delivery" ADD CONSTRAINT "Delivery_storeId_fkey" FOREIGN KEY ("storeId") REFERENCES "Store"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "Delivery" ADD CONSTRAINT "Delivery_riderId_fkey" FOREIGN KEY ("riderId") REFERENCES "Rider"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "DeliveryEvent" ADD CONSTRAINT "DeliveryEvent_deliveryId_fkey" FOREIGN KEY ("deliveryId") REFERENCES "Delivery"("id") ON DELETE CASCADE ON UPDATE CASCADE;
