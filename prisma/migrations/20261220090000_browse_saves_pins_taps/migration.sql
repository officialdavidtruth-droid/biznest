-- AlterTable
ALTER TABLE "BrowsePost" ADD COLUMN "saveCount" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN "shopTapCount" INTEGER NOT NULL DEFAULT 0;

-- AlterTable
ALTER TABLE "BrowseComment" ADD COLUMN "byStore" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN "pinned" BOOLEAN NOT NULL DEFAULT false;

-- CreateTable
CREATE TABLE "BrowseSave" (
    "id" TEXT NOT NULL,
    "postId" TEXT NOT NULL,
    "viewerKey" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "BrowseSave_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "BrowseSave_postId_viewerKey_key" ON "BrowseSave"("postId", "viewerKey");

-- CreateIndex
CREATE INDEX "BrowseSave_viewerKey_createdAt_idx" ON "BrowseSave"("viewerKey", "createdAt");

-- AddForeignKey
ALTER TABLE "BrowseSave" ADD CONSTRAINT "BrowseSave_postId_fkey" FOREIGN KEY ("postId") REFERENCES "BrowsePost"("id") ON DELETE CASCADE ON UPDATE CASCADE;
