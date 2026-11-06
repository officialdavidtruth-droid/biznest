-- Browse: public social feed (posts, likes, comments, reports).
CREATE TABLE "BrowsePost" (
  "id" TEXT NOT NULL,
  "storeId" TEXT NOT NULL,
  "kind" TEXT NOT NULL DEFAULT 'UPDATE',
  "caption" TEXT NOT NULL,
  "images" TEXT[],
  "productId" TEXT,
  "productName" TEXT,
  "productPrice" DECIMAL(12,2),
  "productCurrency" TEXT,
  "status" TEXT NOT NULL DEFAULT 'PUBLISHED',
  "hiddenReason" TEXT,
  "likeCount" INTEGER NOT NULL DEFAULT 0,
  "commentCount" INTEGER NOT NULL DEFAULT 0,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "BrowsePost_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "BrowsePost_status_createdAt_idx" ON "BrowsePost"("status", "createdAt");
CREATE INDEX "BrowsePost_status_likeCount_idx" ON "BrowsePost"("status", "likeCount");
CREATE INDEX "BrowsePost_storeId_createdAt_idx" ON "BrowsePost"("storeId", "createdAt");
ALTER TABLE "BrowsePost" ADD CONSTRAINT "BrowsePost_storeId_fkey" FOREIGN KEY ("storeId") REFERENCES "Store"("id") ON DELETE CASCADE ON UPDATE CASCADE;

CREATE TABLE "BrowseLike" (
  "id" TEXT NOT NULL,
  "postId" TEXT NOT NULL,
  "viewerKey" TEXT NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "BrowseLike_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "BrowseLike_postId_viewerKey_key" ON "BrowseLike"("postId", "viewerKey");
CREATE INDEX "BrowseLike_viewerKey_idx" ON "BrowseLike"("viewerKey");
ALTER TABLE "BrowseLike" ADD CONSTRAINT "BrowseLike_postId_fkey" FOREIGN KEY ("postId") REFERENCES "BrowsePost"("id") ON DELETE CASCADE ON UPDATE CASCADE;

CREATE TABLE "BrowseComment" (
  "id" TEXT NOT NULL,
  "postId" TEXT NOT NULL,
  "viewerKey" TEXT NOT NULL,
  "authorName" TEXT NOT NULL,
  "body" TEXT NOT NULL,
  "status" TEXT NOT NULL DEFAULT 'VISIBLE',
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "BrowseComment_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "BrowseComment_postId_status_createdAt_idx" ON "BrowseComment"("postId", "status", "createdAt");
CREATE INDEX "BrowseComment_viewerKey_idx" ON "BrowseComment"("viewerKey");
ALTER TABLE "BrowseComment" ADD CONSTRAINT "BrowseComment_postId_fkey" FOREIGN KEY ("postId") REFERENCES "BrowsePost"("id") ON DELETE CASCADE ON UPDATE CASCADE;

CREATE TABLE "BrowseReport" (
  "id" TEXT NOT NULL,
  "postId" TEXT NOT NULL,
  "commentId" TEXT,
  "targetKey" TEXT NOT NULL,
  "viewerKey" TEXT NOT NULL,
  "reason" TEXT NOT NULL,
  "status" TEXT NOT NULL DEFAULT 'OPEN',
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "BrowseReport_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "BrowseReport_targetKey_viewerKey_key" ON "BrowseReport"("targetKey", "viewerKey");
CREATE INDEX "BrowseReport_status_createdAt_idx" ON "BrowseReport"("status", "createdAt");
CREATE INDEX "BrowseReport_postId_idx" ON "BrowseReport"("postId");
ALTER TABLE "BrowseReport" ADD CONSTRAINT "BrowseReport_postId_fkey" FOREIGN KEY ("postId") REFERENCES "BrowsePost"("id") ON DELETE CASCADE ON UPDATE CASCADE;
