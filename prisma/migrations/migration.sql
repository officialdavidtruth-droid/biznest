-- FIFO lots for inventory and food/perishable stock.
CREATE TABLE "InventoryBatch" (
  "id" TEXT NOT NULL,
  "storeId" TEXT NOT NULL,
  "inventoryItemId" TEXT,
  "variantId" TEXT,
  "purchaseOrderItemId" TEXT,
  "batchNumber" TEXT,
  "quantityReceived" INTEGER NOT NULL,
  "quantityRemaining" INTEGER NOT NULL,
  "unitCost" DECIMAL(12,2),
  "receivedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "expiryDate" TIMESTAMP(3),
  "sourceNote" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "InventoryBatch_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "InventoryBatchConsumption" (
  "id" TEXT NOT NULL,
  "inventoryBatchId" TEXT NOT NULL,
  "stockMovementId" TEXT NOT NULL,
  "quantity" INTEGER NOT NULL,
  "unitCost" DECIMAL(12,2),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "InventoryBatchConsumption_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "InventoryBatch_storeId_inventoryItemId_receivedAt_id_idx" ON "InventoryBatch"("storeId", "inventoryItemId", "receivedAt", "id");
CREATE INDEX "InventoryBatch_storeId_variantId_receivedAt_id_idx" ON "InventoryBatch"("storeId", "variantId", "receivedAt", "id");
CREATE INDEX "InventoryBatch_expiryDate_idx" ON "InventoryBatch"("expiryDate");
CREATE INDEX "InventoryBatch_purchaseOrderItemId_idx" ON "InventoryBatch"("purchaseOrderItemId");
CREATE INDEX "InventoryBatchConsumption_inventoryBatchId_createdAt_idx" ON "InventoryBatchConsumption"("inventoryBatchId", "createdAt");
CREATE INDEX "InventoryBatchConsumption_stockMovementId_idx" ON "InventoryBatchConsumption"("stockMovementId");

ALTER TABLE "InventoryBatch" ADD CONSTRAINT "InventoryBatch_storeId_fkey" FOREIGN KEY ("storeId") REFERENCES "Store"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "InventoryBatch" ADD CONSTRAINT "InventoryBatch_inventoryItemId_fkey" FOREIGN KEY ("inventoryItemId") REFERENCES "InventoryItem"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "InventoryBatch" ADD CONSTRAINT "InventoryBatch_variantId_fkey" FOREIGN KEY ("variantId") REFERENCES "ProductVariant"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "InventoryBatch" ADD CONSTRAINT "InventoryBatch_purchaseOrderItemId_fkey" FOREIGN KEY ("purchaseOrderItemId") REFERENCES "PurchaseOrderItem"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "InventoryBatchConsumption" ADD CONSTRAINT "InventoryBatchConsumption_inventoryBatchId_fkey" FOREIGN KEY ("inventoryBatchId") REFERENCES "InventoryBatch"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "InventoryBatchConsumption" ADD CONSTRAINT "InventoryBatchConsumption_stockMovementId_fkey" FOREIGN KEY ("stockMovementId") REFERENCES "StockMovement"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Seed a deterministic opening lot for stock that existed before FIFO. The
-- application will continue to create true receipt lots for future stock.
INSERT INTO "InventoryBatch" ("id", "storeId", "inventoryItemId", "batchNumber", "quantityReceived", "quantityRemaining", "unitCost", "receivedAt", "sourceNote", "createdAt", "updatedAt")
SELECT md5(random()::text || clock_timestamp()::text || i."id"), i."storeId", i."id", 'OPENING-BALANCE', i."quantity", i."quantity", i."costPrice", CURRENT_TIMESTAMP, 'Opening balance migrated when FIFO was enabled', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP
FROM "InventoryItem" i
WHERE i."quantity" > 0;

INSERT INTO "InventoryBatch" ("id", "storeId", "variantId", "batchNumber", "quantityReceived", "quantityRemaining", "unitCost", "receivedAt", "sourceNote", "createdAt", "updatedAt")
SELECT md5(random()::text || clock_timestamp()::text || v."id"), v."storeId", v."id", 'OPENING-BALANCE', v."quantity", v."quantity", v."costPrice", CURRENT_TIMESTAMP, 'Opening balance migrated when FIFO was enabled', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP
FROM "ProductVariant" v
WHERE v."quantity" > 0;
