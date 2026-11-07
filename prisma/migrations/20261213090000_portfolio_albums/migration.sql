-- Portfolio albums for photographers and other creatives. Additive only.
CREATE TABLE "PortfolioAlbum" (
    "id" TEXT NOT NULL,
    "storeId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "category" TEXT,
    "description" TEXT,
    "coverUrl" TEXT,
    "isPublished" BOOLEAN NOT NULL DEFAULT true,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PortfolioAlbum_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "PortfolioImage" (
    "id" TEXT NOT NULL,
    "albumId" TEXT NOT NULL,
    "url" TEXT NOT NULL,
    "caption" TEXT,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PortfolioImage_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "PortfolioAlbum_storeId_slug_key" ON "PortfolioAlbum"("storeId", "slug");
CREATE INDEX "PortfolioAlbum_storeId_isPublished_sortOrder_idx" ON "PortfolioAlbum"("storeId", "isPublished", "sortOrder");
CREATE INDEX "PortfolioImage_albumId_sortOrder_idx" ON "PortfolioImage"("albumId", "sortOrder");

ALTER TABLE "PortfolioAlbum" ADD CONSTRAINT "PortfolioAlbum_storeId_fkey" FOREIGN KEY ("storeId") REFERENCES "Store"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "PortfolioImage" ADD CONSTRAINT "PortfolioImage_albumId_fkey" FOREIGN KEY ("albumId") REFERENCES "PortfolioAlbum"("id") ON DELETE CASCADE ON UPDATE CASCADE;
