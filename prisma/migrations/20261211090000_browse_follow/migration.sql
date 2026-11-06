ALTER TABLE "Store" ADD COLUMN "followerCount" INTEGER NOT NULL DEFAULT 0;

CREATE TABLE "BrowseFollow" (
  "id" TEXT NOT NULL,
  "storeId" TEXT NOT NULL,
  "viewerKey" TEXT NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "BrowseFollow_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "BrowseFollow_storeId_viewerKey_key" ON "BrowseFollow"("storeId", "viewerKey");
CREATE INDEX "BrowseFollow_viewerKey_createdAt_idx" ON "BrowseFollow"("viewerKey", "createdAt");
ALTER TABLE "BrowseFollow" ADD CONSTRAINT "BrowseFollow_storeId_fkey" FOREIGN KEY ("storeId") REFERENCES "Store"("id") ON DELETE CASCADE ON UPDATE CASCADE;
