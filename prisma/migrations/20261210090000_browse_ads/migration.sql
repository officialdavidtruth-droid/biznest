ALTER TYPE "PaymentPurpose" ADD VALUE IF NOT EXISTS 'AD_CAMPAIGN';

CREATE TABLE "AdCampaign" (
  "id" TEXT NOT NULL,
  "storeId" TEXT NOT NULL,
  "placement" TEXT NOT NULL,
  "caption" TEXT,
  "imageUrl" TEXT,
  "bgColor" TEXT,
  "ctaLabel" TEXT NOT NULL DEFAULT 'SHOP_NOW',
  "productId" TEXT,
  "productName" TEXT,
  "productPrice" DECIMAL(12,2),
  "productCurrency" TEXT,
  "budget" DECIMAL(12,2) NOT NULL,
  "rateNaira" DECIMAL(12,2) NOT NULL,
  "impressionsBought" INTEGER NOT NULL,
  "durationDays" INTEGER NOT NULL,
  "status" TEXT NOT NULL DEFAULT 'PENDING_PAYMENT',
  "pausedBy" TEXT,
  "paymentReference" TEXT,
  "startsAt" TIMESTAMP(3),
  "endsAt" TIMESTAMP(3),
  "impressions" INTEGER NOT NULL DEFAULT 0,
  "clicks" INTEGER NOT NULL DEFAULT 0,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "AdCampaign_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "AdCampaign_paymentReference_key" ON "AdCampaign"("paymentReference");
CREATE INDEX "AdCampaign_status_placement_endsAt_idx" ON "AdCampaign"("status", "placement", "endsAt");
CREATE INDEX "AdCampaign_storeId_createdAt_idx" ON "AdCampaign"("storeId", "createdAt");
ALTER TABLE "AdCampaign" ADD CONSTRAINT "AdCampaign_storeId_fkey" FOREIGN KEY ("storeId") REFERENCES "Store"("id") ON DELETE CASCADE ON UPDATE CASCADE;

CREATE TABLE "AdViewer" (
  "id" TEXT NOT NULL,
  "campaignId" TEXT NOT NULL,
  "viewerKey" TEXT NOT NULL,
  "seen" INTEGER NOT NULL DEFAULT 0,
  "windowStart" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "AdViewer_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "AdViewer_campaignId_viewerKey_key" ON "AdViewer"("campaignId", "viewerKey");
ALTER TABLE "AdViewer" ADD CONSTRAINT "AdViewer_campaignId_fkey" FOREIGN KEY ("campaignId") REFERENCES "AdCampaign"("id") ON DELETE CASCADE ON UPDATE CASCADE;

CREATE TABLE "AdReport" (
  "id" TEXT NOT NULL,
  "campaignId" TEXT NOT NULL,
  "viewerKey" TEXT NOT NULL,
  "reason" TEXT NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "AdReport_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "AdReport_campaignId_viewerKey_key" ON "AdReport"("campaignId", "viewerKey");
CREATE INDEX "AdReport_campaignId_idx" ON "AdReport"("campaignId");
ALTER TABLE "AdReport" ADD CONSTRAINT "AdReport_campaignId_fkey" FOREIGN KEY ("campaignId") REFERENCES "AdCampaign"("id") ON DELETE CASCADE ON UPDATE CASCADE;
