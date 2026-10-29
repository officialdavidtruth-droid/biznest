-- Merchants can report a review that breaks the rules; BizNest staff decide it
-- from /supaadmin/review-reports. See ReviewReport in schema.prisma.
CREATE TYPE "ReviewReportStatus" AS ENUM ('OPEN', 'UPHELD', 'DISMISSED');

CREATE TABLE "ReviewReport" (
    "id" TEXT NOT NULL,
    "storeId" TEXT NOT NULL,
    "reviewId" TEXT,
    "reportedById" TEXT NOT NULL,
    "reason" TEXT NOT NULL,
    "details" TEXT,
    "status" "ReviewReportStatus" NOT NULL DEFAULT 'OPEN',
    "adminNotes" TEXT,
    "resolvedAt" TIMESTAMP(3),
    "reviewRating" INTEGER NOT NULL,
    "reviewComment" TEXT,
    "reviewAuthorName" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ReviewReport_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "ReviewReport_reviewId_key" ON "ReviewReport"("reviewId");
CREATE INDEX "ReviewReport_status_createdAt_idx" ON "ReviewReport"("status", "createdAt");
CREATE INDEX "ReviewReport_storeId_idx" ON "ReviewReport"("storeId");

ALTER TABLE "ReviewReport" ADD CONSTRAINT "ReviewReport_storeId_fkey" FOREIGN KEY ("storeId") REFERENCES "Store"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "ReviewReport" ADD CONSTRAINT "ReviewReport_reviewId_fkey" FOREIGN KEY ("reviewId") REFERENCES "Review"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "ReviewReport" ADD CONSTRAINT "ReviewReport_reportedById_fkey" FOREIGN KEY ("reportedById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
