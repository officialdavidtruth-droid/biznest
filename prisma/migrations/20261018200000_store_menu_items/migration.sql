-- CreateTable
CREATE TABLE "StoreMenuItem" (
    "id" TEXT NOT NULL,
    "storeId" TEXT NOT NULL,
    "location" TEXT NOT NULL DEFAULT 'header',
    "label" TEXT NOT NULL,
    "linkType" TEXT NOT NULL DEFAULT 'PAGE',
    "target" TEXT,
    "openInNewTab" BOOLEAN NOT NULL DEFAULT false,
    "parentId" TEXT,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "StoreMenuItem_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "StoreMenuItem_storeId_location_sortOrder_idx" ON "StoreMenuItem"("storeId", "location", "sortOrder");

-- CreateIndex
CREATE INDEX "StoreMenuItem_parentId_idx" ON "StoreMenuItem"("parentId");

-- AddForeignKey
ALTER TABLE "StoreMenuItem" ADD CONSTRAINT "StoreMenuItem_storeId_fkey" FOREIGN KEY ("storeId") REFERENCES "Store"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StoreMenuItem" ADD CONSTRAINT "StoreMenuItem_parentId_fkey" FOREIGN KEY ("parentId") REFERENCES "StoreMenuItem"("id") ON DELETE CASCADE ON UPDATE CASCADE;
