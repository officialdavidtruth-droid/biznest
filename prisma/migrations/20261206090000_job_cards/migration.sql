-- Job cards (auto, cleaning, construction, photography). Additive only.
ALTER TYPE "PaymentPurpose" ADD VALUE IF NOT EXISTS 'JOB_PAYMENT';

CREATE TABLE "JobCard" (
  "id" TEXT NOT NULL, "storeId" TEXT NOT NULL, "jobNo" TEXT NOT NULL, "niche" TEXT NOT NULL, "title" TEXT NOT NULL, "customerName" TEXT NOT NULL,
  "customerPhone" TEXT, "customerEmail" TEXT, "subject" TEXT, "subjectDetail" TEXT, "stage" TEXT NOT NULL, "status" TEXT NOT NULL DEFAULT 'OPEN',
  "scheduledFor" TIMESTAMP(3), "completedAt" TIMESTAMP(3), "estimateStatus" TEXT NOT NULL DEFAULT 'NONE', "estimateRespondedAt" TIMESTAMP(3),
  "deliverableUrl" TEXT, "internalNotes" TEXT, "accessToken" TEXT NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP, "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "JobCard_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "JobCard_accessToken_key" ON "JobCard"("accessToken");
CREATE UNIQUE INDEX "JobCard_storeId_jobNo_key" ON "JobCard"("storeId", "jobNo");
CREATE INDEX "JobCard_storeId_status_createdAt_idx" ON "JobCard"("storeId", "status", "createdAt");

CREATE TABLE "JobCardItem" (
  "id" TEXT NOT NULL, "jobId" TEXT NOT NULL, "kind" TEXT NOT NULL DEFAULT 'LABOUR', "label" TEXT NOT NULL, "qty" INTEGER NOT NULL DEFAULT 1, "unitPrice" DECIMAL(12,2) NOT NULL,
  CONSTRAINT "JobCardItem_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "JobCardItem_jobId_idx" ON "JobCardItem"("jobId");

CREATE TABLE "JobCharge" (
  "id" TEXT NOT NULL, "storeId" TEXT NOT NULL, "jobId" TEXT NOT NULL, "label" TEXT NOT NULL, "amount" DECIMAL(12,2) NOT NULL, "status" TEXT NOT NULL DEFAULT 'DUE',
  "paidAt" TIMESTAMP(3), "method" TEXT, "reference" TEXT, "receiptNo" TEXT, "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "JobCharge_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "JobCharge_storeId_receiptNo_key" ON "JobCharge"("storeId", "receiptNo");
CREATE INDEX "JobCharge_jobId_status_idx" ON "JobCharge"("jobId", "status");

CREATE TABLE "JobUpdate" (
  "id" TEXT NOT NULL, "jobId" TEXT NOT NULL, "message" TEXT NOT NULL, "imageUrl" TEXT, "stage" TEXT, "at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "JobUpdate_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "JobUpdate_jobId_at_idx" ON "JobUpdate"("jobId", "at");

ALTER TABLE "JobCard" ADD CONSTRAINT "JobCard_storeId_fkey" FOREIGN KEY ("storeId") REFERENCES "Store"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "JobCardItem" ADD CONSTRAINT "JobCardItem_jobId_fkey" FOREIGN KEY ("jobId") REFERENCES "JobCard"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "JobCharge" ADD CONSTRAINT "JobCharge_storeId_fkey" FOREIGN KEY ("storeId") REFERENCES "Store"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "JobCharge" ADD CONSTRAINT "JobCharge_jobId_fkey" FOREIGN KEY ("jobId") REFERENCES "JobCard"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "JobUpdate" ADD CONSTRAINT "JobUpdate_jobId_fkey" FOREIGN KEY ("jobId") REFERENCES "JobCard"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "Payment" ADD COLUMN "jobChargeId" TEXT;
CREATE INDEX "Payment_jobChargeId_idx" ON "Payment"("jobChargeId");
ALTER TABLE "Payment" ADD CONSTRAINT "Payment_jobChargeId_fkey" FOREIGN KEY ("jobChargeId") REFERENCES "JobCharge"("id") ON DELETE SET NULL ON UPDATE CASCADE;
