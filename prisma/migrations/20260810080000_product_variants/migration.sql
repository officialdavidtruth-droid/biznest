-- Product variants (size/color/etc combos with their own SKU/barcode/price/stock),
-- plus a barcode field on the existing single-SKU InventoryItem path.
-- Additive-only except for relaxing StockMovement.inventoryItemId to nullable
-- (a movement now belongs to either a plain InventoryItem or a ProductVariant).

-- Product: variant opt-in + option schema
ALTER TABLE "Product" ADD COLUMN "hasVariants" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "Product" ADD COLUMN "variantOptions" JSONB;

-- InventoryItem: barcode field (scan-to-lookup on receiving) + uniqueness
ALTER TABLE "InventoryItem" ADD COLUMN "barcode" TEXT;
CREATE UNIQUE INDEX "InventoryItem_storeId_sku_key" ON "InventoryItem"("storeId", "sku");
CREATE UNIQUE INDEX "InventoryItem_storeId_barcode_key" ON "InventoryItem"("storeId", "barcode");

-- New table: ProductVariant
CREATE TABLE "ProductVariant" (
    "id" TEXT NOT NULL,
    "productId" TEXT NOT NULL,
    "storeId" TEXT NOT NULL,
    "optionValues" JSONB NOT NULL,
    "label" TEXT NOT NULL,
    "sku" TEXT,
    "barcode" TEXT,
    "price" DECIMAL(12,2),
    "images" TEXT[],
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "quantity" INTEGER NOT NULL DEFAULT 0,
    "lowStockThreshold" INTEGER NOT NULL DEFAULT 5,
    "costPrice" DECIMAL(12,2),
    "autoUnpublished" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ProductVariant_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "ProductVariant_storeId_sku_key" ON "ProductVariant"("storeId", "sku");
CREATE UNIQUE INDEX "ProductVariant_storeId_barcode_key" ON "ProductVariant"("storeId", "barcode");
CREATE INDEX "ProductVariant_productId_idx" ON "ProductVariant"("productId");
CREATE INDEX "ProductVariant_storeId_idx" ON "ProductVariant"("storeId");

ALTER TABLE "ProductVariant" ADD CONSTRAINT "ProductVariant_productId_fkey"
    FOREIGN KEY ("productId") REFERENCES "Product"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "ProductVariant" ADD CONSTRAINT "ProductVariant_storeId_fkey"
    FOREIGN KEY ("storeId") REFERENCES "Store"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- StockMovement: allow a movement to point at a variant instead of a plain
-- InventoryItem. Existing rows all have inventoryItemId set, so relaxing the
-- NOT NULL constraint is safe and lossless.
ALTER TABLE "StockMovement" ALTER COLUMN "inventoryItemId" DROP NOT NULL;
ALTER TABLE "StockMovement" ADD COLUMN "variantId" TEXT;
CREATE INDEX "StockMovement_variantId_createdAt_idx" ON "StockMovement"("variantId", "createdAt");
ALTER TABLE "StockMovement" ADD CONSTRAINT "StockMovement_variantId_fkey"
    FOREIGN KEY ("variantId") REFERENCES "ProductVariant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- OrderItem: which variant (if any) was purchased
ALTER TABLE "OrderItem" ADD COLUMN "variantId" TEXT;
ALTER TABLE "OrderItem" ADD CONSTRAINT "OrderItem_variantId_fkey"
    FOREIGN KEY ("variantId") REFERENCES "ProductVariant"("id") ON DELETE SET NULL ON UPDATE CASCADE;
