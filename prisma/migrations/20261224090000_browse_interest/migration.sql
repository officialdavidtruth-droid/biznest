-- CreateTable
CREATE TABLE "BrowseInterest" (
    "id" TEXT NOT NULL,
    "viewerKey" TEXT NOT NULL,
    "kind" TEXT NOT NULL,
    "key" TEXT NOT NULL,
    "weight" DOUBLE PRECISION NOT NULL,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "BrowseInterest_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "BrowseInterest_viewerKey_kind_key_key" ON "BrowseInterest"("viewerKey", "kind", "key");

-- CreateIndex
CREATE INDEX "BrowseInterest_viewerKey_weight_idx" ON "BrowseInterest"("viewerKey", "weight");

-- CreateIndex
CREATE INDEX "BrowseInterest_updatedAt_idx" ON "BrowseInterest"("updatedAt");
