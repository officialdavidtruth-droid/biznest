-- CreateTable
CREATE TABLE "BrowseStat" (
    "id" TEXT NOT NULL,
    "storeId" TEXT NOT NULL,
    "day" DATE NOT NULL,
    "kind" TEXT NOT NULL,
    "postId" TEXT NOT NULL DEFAULT '',
    "count" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "BrowseStat_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "BrowseStat_storeId_day_kind_postId_key" ON "BrowseStat"("storeId", "day", "kind", "postId");

-- CreateIndex
CREATE INDEX "BrowseStat_storeId_day_idx" ON "BrowseStat"("storeId", "day");

-- AddForeignKey
ALTER TABLE "BrowseStat" ADD CONSTRAINT "BrowseStat_storeId_fkey" FOREIGN KEY ("storeId") REFERENCES "Store"("id") ON DELETE CASCADE ON UPDATE CASCADE;
