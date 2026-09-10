CREATE TYPE "RequisitionStatus" AS ENUM ('DRAFT','SUBMITTED','APPROVED','REJECTED','CONVERTED','CANCELLED');
CREATE TYPE "RequisitionPriority" AS ENUM ('LOW','NORMAL','HIGH','URGENT');

ALTER TABLE "Store" ADD COLUMN "nextRequisitionNo" INTEGER NOT NULL DEFAULT 1;

CREATE TABLE "Requisition" (
  "id" TEXT NOT NULL,
  "number" TEXT NOT NULL,
  "storeId" TEXT NOT NULL,
  "title" TEXT NOT NULL,
  "department" TEXT,
  "requesterName" TEXT,
  "priority" "RequisitionPriority" NOT NULL DEFAULT 'NORMAL',
  "status" "RequisitionStatus" NOT NULL DEFAULT 'DRAFT',
  "neededBy" TIMESTAMP(3),
  "notes" TEXT,
  "decisionNote" TEXT,
  "submittedAt" TIMESTAMP(3),
  "decidedAt" TIMESTAMP(3),
  "convertedAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "Requisition_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "Requisition_number_key" ON "Requisition"("number");
CREATE INDEX "Requisition_storeId_status_idx" ON "Requisition"("storeId","status");
CREATE INDEX "Requisition_storeId_priority_idx" ON "Requisition"("storeId","priority");
CREATE INDEX "Requisition_storeId_neededBy_idx" ON "Requisition"("storeId","neededBy");
CREATE INDEX "Requisition_storeId_createdAt_idx" ON "Requisition"("storeId","createdAt");
ALTER TABLE "Requisition" ADD CONSTRAINT "Requisition_storeId_fkey" FOREIGN KEY ("storeId") REFERENCES "Store"("id") ON DELETE CASCADE ON UPDATE CASCADE;

CREATE TABLE "RequisitionItem" (
  "id" TEXT NOT NULL,
  "requisitionId" TEXT NOT NULL,
  "productId" TEXT,
  "variantId" TEXT,
  "description" TEXT NOT NULL,
  "quantity" INTEGER NOT NULL,
  "unit" TEXT,
  "estimatedUnitCost" DECIMAL(12,2),
  "note" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "RequisitionItem_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "RequisitionItem_requisitionId_idx" ON "RequisitionItem"("requisitionId");
CREATE INDEX "RequisitionItem_productId_idx" ON "RequisitionItem"("productId");
CREATE INDEX "RequisitionItem_variantId_idx" ON "RequisitionItem"("variantId");
ALTER TABLE "RequisitionItem" ADD CONSTRAINT "RequisitionItem_requisitionId_fkey" FOREIGN KEY ("requisitionId") REFERENCES "Requisition"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "RequisitionItem" ADD CONSTRAINT "RequisitionItem_productId_fkey" FOREIGN KEY ("productId") REFERENCES "Product"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "RequisitionItem" ADD CONSTRAINT "RequisitionItem_variantId_fkey" FOREIGN KEY ("variantId") REFERENCES "ProductVariant"("id") ON DELETE SET NULL ON UPDATE CASCADE;
