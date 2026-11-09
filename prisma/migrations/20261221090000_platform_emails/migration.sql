-- AlterTable
ALTER TABLE "User" ADD COLUMN "platformEmailOptOutAt" TIMESTAMP(3);

-- CreateTable
CREATE TABLE "PlatformEmailLog" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "kind" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PlatformEmailLog_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PlatformCampaign" (
    "id" TEXT NOT NULL,
    "subject" TEXT NOT NULL,
    "body" TEXT NOT NULL,
    "ctaLabel" TEXT,
    "ctaUrl" TEXT,
    "audience" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'DRAFT',
    "sentCount" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "sentAt" TIMESTAMP(3),

    CONSTRAINT "PlatformCampaign_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "PlatformEmailLog_userId_kind_key" ON "PlatformEmailLog"("userId", "kind");

-- CreateIndex
CREATE INDEX "PlatformEmailLog_kind_idx" ON "PlatformEmailLog"("kind");

-- CreateIndex
CREATE INDEX "PlatformCampaign_status_idx" ON "PlatformCampaign"("status");

-- AddForeignKey
ALTER TABLE "PlatformEmailLog" ADD CONSTRAINT "PlatformEmailLog_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
