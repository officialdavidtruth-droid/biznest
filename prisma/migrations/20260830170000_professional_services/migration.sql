ALTER TABLE "Business" ADD COLUMN "businessSubcategory" TEXT;

CREATE TYPE "CreativeProjectStatus" AS ENUM ('NEW','BRIEFING','QUOTED','DESIGN','AWAITING_APPROVAL','APPROVED','IN_PRODUCTION','QUALITY_CHECK','READY','DELIVERED','COMPLETED','ON_HOLD','CANCELLED');

CREATE TABLE "CreativeProject" (
  "id" TEXT NOT NULL,
  "projectNo" TEXT NOT NULL,
  "publicAccessToken" TEXT NOT NULL,
  "storeId" TEXT NOT NULL,
  "customerId" TEXT,
  "customerName" TEXT NOT NULL,
  "customerEmail" TEXT,
  "customerPhone" TEXT,
  "serviceType" TEXT NOT NULL,
  "brief" TEXT NOT NULL,
  "budget" DECIMAL(12,2),
  "deadline" TIMESTAMP(3),
  "referenceFiles" JSONB,
  "status" "CreativeProjectStatus" NOT NULL DEFAULT 'NEW',
  "currentVersion" INTEGER NOT NULL DEFAULT 0,
  "approvalNote" TEXT,
  "quoteId" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "CreativeProject_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "CreativeProject_projectNo_key" ON "CreativeProject"("projectNo");
CREATE UNIQUE INDEX "CreativeProject_publicAccessToken_key" ON "CreativeProject"("publicAccessToken");
CREATE UNIQUE INDEX "CreativeProject_quoteId_key" ON "CreativeProject"("quoteId");
CREATE INDEX "CreativeProject_storeId_status_idx" ON "CreativeProject"("storeId","status");
CREATE INDEX "CreativeProject_customerId_idx" ON "CreativeProject"("customerId");
ALTER TABLE "CreativeProject" ADD CONSTRAINT "CreativeProject_storeId_fkey" FOREIGN KEY ("storeId") REFERENCES "Store"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "CreativeProject" ADD CONSTRAINT "CreativeProject_customerId_fkey" FOREIGN KEY ("customerId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "CreativeProject" ADD CONSTRAINT "CreativeProject_quoteId_fkey" FOREIGN KEY ("quoteId") REFERENCES "Quote"("id") ON DELETE SET NULL ON UPDATE CASCADE;

CREATE TABLE "CreativeProjectRevision" (
  "id" TEXT NOT NULL,
  "projectId" TEXT NOT NULL,
  "version" INTEGER NOT NULL,
  "previewUrl" TEXT NOT NULL,
  "note" TEXT,
  "status" TEXT NOT NULL DEFAULT 'PENDING',
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "CreativeProjectRevision_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "CreativeProjectRevision_projectId_version_key" ON "CreativeProjectRevision"("projectId","version");
CREATE INDEX "CreativeProjectRevision_projectId_idx" ON "CreativeProjectRevision"("projectId");
ALTER TABLE "CreativeProjectRevision" ADD CONSTRAINT "CreativeProjectRevision_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "CreativeProject"("id") ON DELETE CASCADE ON UPDATE CASCADE;
