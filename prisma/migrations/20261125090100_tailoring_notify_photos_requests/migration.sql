-- BizNest Tailoring: automatic customer messages, job photos + tailor, storefront order requests, online balance payments. Additive only.
ALTER TABLE "Store" ADD COLUMN IF NOT EXISTS "tailoringAutoNotify" BOOLEAN NOT NULL DEFAULT false;

ALTER TABLE "TailoringJob" ADD COLUMN IF NOT EXISTS "tailorName" TEXT;
ALTER TABLE "TailoringJob" ADD COLUMN IF NOT EXISTS "photos" JSONB;
CREATE INDEX IF NOT EXISTS "TailoringJob_storeId_tailorName_idx" ON "TailoringJob"("storeId", "tailorName");

ALTER TABLE "Payment" ADD COLUMN IF NOT EXISTS "tailoringJobId" TEXT;
CREATE INDEX IF NOT EXISTS "Payment_tailoringJobId_idx" ON "Payment"("tailoringJobId");
ALTER TABLE "Payment" ADD CONSTRAINT "Payment_tailoringJobId_fkey" FOREIGN KEY ("tailoringJobId") REFERENCES "TailoringJob"("id") ON DELETE SET NULL ON UPDATE CASCADE;

CREATE TABLE "TailoringRequest" (
    "id" TEXT NOT NULL,
    "storeId" TEXT NOT NULL,
    "customerName" TEXT NOT NULL,
    "customerPhone" TEXT NOT NULL,
    "customerEmail" TEXT,
    "garmentType" TEXT NOT NULL,
    "details" TEXT,
    "neededBy" TIMESTAMP(3),
    "photos" JSONB,
    "status" TEXT NOT NULL DEFAULT 'NEW',
    "jobId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "TailoringRequest_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "TailoringRequest_storeId_status_createdAt_idx" ON "TailoringRequest"("storeId", "status", "createdAt");
ALTER TABLE "TailoringRequest" ADD CONSTRAINT "TailoringRequest_storeId_fkey" FOREIGN KEY ("storeId") REFERENCES "Store"("id") ON DELETE CASCADE ON UPDATE CASCADE;
