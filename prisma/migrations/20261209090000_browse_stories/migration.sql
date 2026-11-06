-- Browse stories (24h) and story reports.
CREATE TABLE "BrowseStory" (
  "id" TEXT NOT NULL,
  "storeId" TEXT NOT NULL,
  "kind" TEXT NOT NULL DEFAULT 'IMAGE',
  "imageUrl" TEXT,
  "text" TEXT,
  "bgColor" TEXT,
  "productId" TEXT,
  "productName" TEXT,
  "productPrice" DECIMAL(12,2),
  "productCurrency" TEXT,
  "status" TEXT NOT NULL DEFAULT 'ACTIVE',
  "viewCount" INTEGER NOT NULL DEFAULT 0,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "expiresAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "BrowseStory_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "BrowseStory_status_expiresAt_idx" ON "BrowseStory"("status", "expiresAt");
CREATE INDEX "BrowseStory_storeId_createdAt_idx" ON "BrowseStory"("storeId", "createdAt");
ALTER TABLE "BrowseStory" ADD CONSTRAINT "BrowseStory_storeId_fkey" FOREIGN KEY ("storeId") REFERENCES "Store"("id") ON DELETE CASCADE ON UPDATE CASCADE;

CREATE TABLE "BrowseStoryView" (
  "id" TEXT NOT NULL,
  "storyId" TEXT NOT NULL,
  "viewerKey" TEXT NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "BrowseStoryView_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "BrowseStoryView_storyId_viewerKey_key" ON "BrowseStoryView"("storyId", "viewerKey");
CREATE INDEX "BrowseStoryView_viewerKey_createdAt_idx" ON "BrowseStoryView"("viewerKey", "createdAt");
ALTER TABLE "BrowseStoryView" ADD CONSTRAINT "BrowseStoryView_storyId_fkey" FOREIGN KEY ("storyId") REFERENCES "BrowseStory"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Reports can now point at a story instead of a post.
ALTER TABLE "BrowseReport" ALTER COLUMN "postId" DROP NOT NULL;
ALTER TABLE "BrowseReport" ADD COLUMN "storyId" TEXT;
CREATE INDEX "BrowseReport_storyId_idx" ON "BrowseReport"("storyId");
ALTER TABLE "BrowseReport" ADD CONSTRAINT "BrowseReport_storyId_fkey" FOREIGN KEY ("storyId") REFERENCES "BrowseStory"("id") ON DELETE CASCADE ON UPDATE CASCADE;
