-- BizNest Recruitment (applicant tracking): additive only.
CREATE TYPE "RecruitJobStatus" AS ENUM ('DRAFT', 'OPEN', 'ON_HOLD', 'FILLED', 'CLOSED');
CREATE TYPE "RecruitStage" AS ENUM ('APPLIED', 'SCREENING', 'INTERVIEW', 'OFFER', 'HIRED', 'REJECTED', 'WITHDRAWN');

CREATE TABLE "RecruitJob" (
  "id" TEXT NOT NULL, "storeId" TEXT NOT NULL, "title" TEXT NOT NULL, "clientName" TEXT, "department" TEXT, "location" TEXT,
  "employmentType" TEXT NOT NULL DEFAULT 'FULL_TIME',
  "salaryMin" DECIMAL(14,2), "salaryMax" DECIMAL(14,2), "openings" INTEGER NOT NULL DEFAULT 1,
  "description" TEXT, "requirements" TEXT,
  "status" "RecruitJobStatus" NOT NULL DEFAULT 'OPEN', "closesAt" DATE,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP, "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "RecruitJob_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "RecruitCandidate" (
  "id" TEXT NOT NULL, "storeId" TEXT NOT NULL, "firstName" TEXT NOT NULL, "lastName" TEXT NOT NULL,
  "email" TEXT, "phone" TEXT, "currentRole" TEXT, "currentCompany" TEXT, "location" TEXT, "skills" TEXT,
  "source" TEXT, "cvUrl" TEXT, "notes" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP, "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "RecruitCandidate_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "RecruitApplication" (
  "id" TEXT NOT NULL, "storeId" TEXT NOT NULL, "jobId" TEXT NOT NULL, "candidateId" TEXT NOT NULL,
  "stage" "RecruitStage" NOT NULL DEFAULT 'APPLIED', "rating" INTEGER, "interviewAt" TIMESTAMP(3),
  "offerAmount" DECIMAL(14,2), "rejectionReason" TEXT, "notes" TEXT,
  "stageChangedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP, "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "RecruitApplication_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "RecruitJob_storeId_status_idx" ON "RecruitJob"("storeId", "status");
CREATE INDEX "RecruitJob_storeId_createdAt_idx" ON "RecruitJob"("storeId", "createdAt");
CREATE UNIQUE INDEX "RecruitCandidate_storeId_email_key" ON "RecruitCandidate"("storeId", "email");
CREATE INDEX "RecruitCandidate_storeId_lastName_idx" ON "RecruitCandidate"("storeId", "lastName");
CREATE UNIQUE INDEX "RecruitApplication_jobId_candidateId_key" ON "RecruitApplication"("jobId", "candidateId");
CREATE INDEX "RecruitApplication_storeId_stage_idx" ON "RecruitApplication"("storeId", "stage");
CREATE INDEX "RecruitApplication_candidateId_idx" ON "RecruitApplication"("candidateId");

ALTER TABLE "RecruitJob" ADD CONSTRAINT "RecruitJob_storeId_fkey" FOREIGN KEY ("storeId") REFERENCES "Store"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "RecruitCandidate" ADD CONSTRAINT "RecruitCandidate_storeId_fkey" FOREIGN KEY ("storeId") REFERENCES "Store"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "RecruitApplication" ADD CONSTRAINT "RecruitApplication_storeId_fkey" FOREIGN KEY ("storeId") REFERENCES "Store"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "RecruitApplication" ADD CONSTRAINT "RecruitApplication_jobId_fkey" FOREIGN KEY ("jobId") REFERENCES "RecruitJob"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "RecruitApplication" ADD CONSTRAINT "RecruitApplication_candidateId_fkey" FOREIGN KEY ("candidateId") REFERENCES "RecruitCandidate"("id") ON DELETE CASCADE ON UPDATE CASCADE;
