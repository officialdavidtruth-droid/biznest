-- AlterTable
ALTER TABLE "BrowsePost" ADD COLUMN "location" TEXT,
ADD COLUMN "aiGenerated" BOOLEAN NOT NULL DEFAULT false;

-- CreateTable
CREATE TABLE "BrowsePostTag" (
    "id" TEXT NOT NULL,
    "postId" TEXT NOT NULL,
    "tagStoreId" TEXT,
    "tagUserId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "BrowsePostTag_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "BrowsePostTag_tagStoreId_idx" ON "BrowsePostTag"("tagStoreId");

-- CreateIndex
CREATE INDEX "BrowsePostTag_tagUserId_idx" ON "BrowsePostTag"("tagUserId");

-- CreateIndex
CREATE UNIQUE INDEX "BrowsePostTag_postId_tagStoreId_key" ON "BrowsePostTag"("postId", "tagStoreId");

-- CreateIndex
CREATE UNIQUE INDEX "BrowsePostTag_postId_tagUserId_key" ON "BrowsePostTag"("postId", "tagUserId");

-- AddForeignKey
ALTER TABLE "BrowsePostTag" ADD CONSTRAINT "BrowsePostTag_postId_fkey" FOREIGN KEY ("postId") REFERENCES "BrowsePost"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BrowsePostTag" ADD CONSTRAINT "BrowsePostTag_tagStoreId_fkey" FOREIGN KEY ("tagStoreId") REFERENCES "Store"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BrowsePostTag" ADD CONSTRAINT "BrowsePostTag_tagUserId_fkey" FOREIGN KEY ("tagUserId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
