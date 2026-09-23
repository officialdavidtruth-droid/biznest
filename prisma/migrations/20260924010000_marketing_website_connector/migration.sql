CREATE TABLE "MarketingWebsiteConnection" (
  "id" TEXT NOT NULL,
  "storeId" TEXT NOT NULL,
  "websiteUrl" TEXT NOT NULL,
  "status" TEXT NOT NULL DEFAULT 'CONNECTED',
  "businessName" TEXT,
  "businessType" TEXT,
  "logoUrl" TEXT,
  "primaryColor" TEXT,
  "secondaryColor" TEXT,
  "description" TEXT,
  "contactEmail" TEXT,
  "contactPhone" TEXT,
  "socialLinks" JSONB,
  "pages" JSONB,
  "lastScannedAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "MarketingWebsiteConnection_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "MarketingWebsiteConnection_storeId_key" ON "MarketingWebsiteConnection"("storeId");
CREATE INDEX "MarketingWebsiteConnection_status_idx" ON "MarketingWebsiteConnection"("status");
ALTER TABLE "MarketingWebsiteConnection" ADD CONSTRAINT "MarketingWebsiteConnection_storeId_fkey" FOREIGN KEY ("storeId") REFERENCES "Store"("id") ON DELETE CASCADE ON UPDATE CASCADE;

CREATE TABLE "MarketingCatalogItem" (
  "id" TEXT NOT NULL,
  "storeId" TEXT NOT NULL,
  "externalKey" TEXT NOT NULL,
  "type" TEXT NOT NULL DEFAULT 'PRODUCT',
  "name" TEXT NOT NULL,
  "description" TEXT,
  "imageUrl" TEXT,
  "url" TEXT,
  "price" TEXT,
  "salePrice" TEXT,
  "currency" TEXT,
  "category" TEXT,
  "availability" TEXT,
  "metadata" JSONB,
  "sourceUrl" TEXT,
  "isActive" BOOLEAN NOT NULL DEFAULT true,
  "lastSeenAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "MarketingCatalogItem_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "MarketingCatalogItem_storeId_externalKey_key" ON "MarketingCatalogItem"("storeId", "externalKey");
CREATE INDEX "MarketingCatalogItem_storeId_type_idx" ON "MarketingCatalogItem"("storeId", "type");
CREATE INDEX "MarketingCatalogItem_storeId_isActive_idx" ON "MarketingCatalogItem"("storeId", "isActive");
ALTER TABLE "MarketingCatalogItem" ADD CONSTRAINT "MarketingCatalogItem_storeId_fkey" FOREIGN KEY ("storeId") REFERENCES "Store"("id") ON DELETE CASCADE ON UPDATE CASCADE;
