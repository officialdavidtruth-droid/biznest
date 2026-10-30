-- CreateTable
CREATE TABLE "SupportRequest" (
    "id" TEXT NOT NULL,
    "storeId" TEXT,
    "storeSlug" TEXT,
    "storeName" TEXT,
    "userId" TEXT NOT NULL,
    "userEmail" TEXT,
    "userName" TEXT,
    "message" TEXT NOT NULL,
    "transcript" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'OPEN',
    "emailSent" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "SupportRequest_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "SupportRequest_status_createdAt_idx" ON "SupportRequest"("status", "createdAt");

-- CreateIndex
CREATE INDEX "SupportRequest_storeId_idx" ON "SupportRequest"("storeId");

-- CreateIndex
CREATE INDEX "SupportRequest_userId_createdAt_idx" ON "SupportRequest"("userId", "createdAt");
