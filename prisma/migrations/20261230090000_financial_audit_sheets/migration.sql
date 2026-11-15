CREATE TABLE "FinancialSheet" (
    "id" TEXT NOT NULL,
    "storeId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "cells" JSONB NOT NULL DEFAULT '{}',
    "createdBy" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "FinancialSheet_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "FinancialAudit" (
    "id" TEXT NOT NULL,
    "storeId" TEXT NOT NULL,
    "auditNo" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'IN_PROGRESS',
    "auditorName" TEXT,
    "scope" TEXT,
    "conclusion" TEXT,
    "varianceValue" DECIMAL(14,2) NOT NULL DEFAULT 0,
    "journalPosted" BOOLEAN NOT NULL DEFAULT false,
    "startedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "completedAt" TIMESTAMP(3),
    "signedOffAt" TIMESTAMP(3),
    "signedOffBy" TEXT,
    "createdBy" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "FinancialAudit_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "FinancialAuditLine" (
    "id" TEXT NOT NULL,
    "auditId" TEXT NOT NULL,
    "subjectType" TEXT NOT NULL,
    "subjectId" TEXT,
    "label" TEXT NOT NULL,
    "sku" TEXT,
    "expectedQty" DECIMAL(14,2) NOT NULL,
    "countedQty" DECIMAL(14,2),
    "unitCost" DECIMAL(14,2) NOT NULL DEFAULT 0,
    "note" TEXT,
    "countedAt" TIMESTAMP(3),
    CONSTRAINT "FinancialAuditLine_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "FinancialAuditFinding" (
    "id" TEXT NOT NULL,
    "auditId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "detail" TEXT,
    "severity" TEXT NOT NULL DEFAULT 'MEDIUM',
    "status" TEXT NOT NULL DEFAULT 'OPEN',
    "recommendation" TEXT,
    "response" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "FinancialAuditFinding_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "FinancialSheet_storeId_updatedAt_idx" ON "FinancialSheet"("storeId", "updatedAt");
CREATE UNIQUE INDEX "FinancialAudit_storeId_auditNo_key" ON "FinancialAudit"("storeId", "auditNo");
CREATE INDEX "FinancialAudit_storeId_status_idx" ON "FinancialAudit"("storeId", "status");
CREATE INDEX "FinancialAuditLine_auditId_idx" ON "FinancialAuditLine"("auditId");
CREATE INDEX "FinancialAuditFinding_auditId_status_idx" ON "FinancialAuditFinding"("auditId", "status");

ALTER TABLE "FinancialSheet" ADD CONSTRAINT "FinancialSheet_storeId_fkey" FOREIGN KEY ("storeId") REFERENCES "Store"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "FinancialAudit" ADD CONSTRAINT "FinancialAudit_storeId_fkey" FOREIGN KEY ("storeId") REFERENCES "Store"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "FinancialAuditLine" ADD CONSTRAINT "FinancialAuditLine_auditId_fkey" FOREIGN KEY ("auditId") REFERENCES "FinancialAudit"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "FinancialAuditFinding" ADD CONSTRAINT "FinancialAuditFinding_auditId_fkey" FOREIGN KEY ("auditId") REFERENCES "FinancialAudit"("id") ON DELETE CASCADE ON UPDATE CASCADE;
