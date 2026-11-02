-- BizNest Blog: additive only (new enum and tables, no changes to existing tables).
CREATE TYPE "BlogPostStatus" AS ENUM ('DRAFT', 'SCHEDULED', 'PUBLISHED');

CREATE TABLE "BlogCategory" (
  "id" TEXT NOT NULL, "storeId" TEXT NOT NULL, "name" TEXT NOT NULL, "slug" TEXT NOT NULL, "description" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "BlogCategory_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "BlogPost" (
  "id" TEXT NOT NULL, "storeId" TEXT NOT NULL, "categoryId" TEXT,
  "title" TEXT NOT NULL, "slug" TEXT NOT NULL, "excerpt" TEXT, "body" TEXT NOT NULL,
  "tags" TEXT[] DEFAULT ARRAY[]::TEXT[],
  "featuredImage" TEXT, "featuredImageAlt" TEXT,
  "authorId" TEXT, "authorName" TEXT NOT NULL,
  "status" "BlogPostStatus" NOT NULL DEFAULT 'DRAFT', "publishedAt" TIMESTAMP(3),
  "isFeatured" BOOLEAN NOT NULL DEFAULT false,
  "seoTitle" TEXT, "seoDescription" TEXT,
  "readingMinutes" INTEGER NOT NULL DEFAULT 1,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP, "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "BlogPost_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "BlogCategory_storeId_slug_key" ON "BlogCategory"("storeId", "slug");
CREATE UNIQUE INDEX "BlogPost_storeId_slug_key" ON "BlogPost"("storeId", "slug");
CREATE INDEX "BlogPost_storeId_status_publishedAt_idx" ON "BlogPost"("storeId", "status", "publishedAt");
CREATE INDEX "BlogPost_storeId_categoryId_idx" ON "BlogPost"("storeId", "categoryId");

ALTER TABLE "BlogCategory" ADD CONSTRAINT "BlogCategory_storeId_fkey" FOREIGN KEY ("storeId") REFERENCES "Store"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "BlogPost" ADD CONSTRAINT "BlogPost_storeId_fkey" FOREIGN KEY ("storeId") REFERENCES "Store"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "BlogPost" ADD CONSTRAINT "BlogPost_categoryId_fkey" FOREIGN KEY ("categoryId") REFERENCES "BlogCategory"("id") ON DELETE SET NULL ON UPDATE CASCADE;
