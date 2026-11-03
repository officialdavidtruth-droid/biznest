-- BizNest Tailoring: job price/payments, saved customer measurements, public status token. Additive only.
CREATE TABLE "TailoringClient" (
    "id" TEXT NOT NULL,
    "storeId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "phone" TEXT,
    "phoneKey" TEXT,
    "measurements" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "TailoringClient_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "TailoringClient_storeId_phoneKey_key" ON "TailoringClient"("storeId", "phoneKey");
ALTER TABLE "TailoringClient" ADD CONSTRAINT "TailoringClient_storeId_fkey" FOREIGN KEY ("storeId") REFERENCES "Store"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- A volatile DEFAULT is evaluated per existing row, so every current job gets its own random token.
ALTER TABLE "TailoringJob" ADD COLUMN "price" DECIMAL(12,2);
ALTER TABLE "TailoringJob" ADD COLUMN "amountPaid" DECIMAL(12,2) NOT NULL DEFAULT 0;
ALTER TABLE "TailoringJob" ADD COLUMN "trackingToken" TEXT NOT NULL DEFAULT replace((gen_random_uuid())::text, '-', '');
ALTER TABLE "TailoringJob" ADD COLUMN "clientId" TEXT;
CREATE UNIQUE INDEX "TailoringJob_trackingToken_key" ON "TailoringJob"("trackingToken");
CREATE INDEX "TailoringJob_clientId_idx" ON "TailoringJob"("clientId");
ALTER TABLE "TailoringJob" ADD CONSTRAINT "TailoringJob_clientId_fkey" FOREIGN KEY ("clientId") REFERENCES "TailoringClient"("id") ON DELETE SET NULL ON UPDATE CASCADE;
