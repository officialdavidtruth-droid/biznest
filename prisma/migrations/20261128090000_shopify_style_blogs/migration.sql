-- Shopify-style blogs: Blog (container) + Article. Replaces BlogPost / BlogCategory.
-- Data is carried over: every store with blog content gets one blog titled "News"; a post's category
-- becomes a tag on its article; DRAFT posts become Hidden (publishedAt NULL); the "featured" pin is dropped.

CREATE TABLE "Blog" (
  "id" TEXT NOT NULL,
  "storeId" TEXT NOT NULL,
  "title" TEXT NOT NULL,
  "handle" TEXT NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "Blog_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "Article" (
  "id" TEXT NOT NULL,
  "storeId" TEXT NOT NULL,
  "blogId" TEXT NOT NULL,
  "title" TEXT NOT NULL,
  "handle" TEXT NOT NULL,
  "excerpt" TEXT,
  "body" TEXT NOT NULL,
  "tags" TEXT[] DEFAULT ARRAY[]::TEXT[],
  "imageUrl" TEXT,
  "imageAlt" TEXT,
  "authorId" TEXT,
  "authorName" TEXT NOT NULL,
  "publishedAt" TIMESTAMP(3),
  "seoTitle" TEXT,
  "seoDescription" TEXT,
  "readingMinutes" INTEGER NOT NULL DEFAULT 1,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "Article_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "Blog_storeId_handle_key" ON "Blog"("storeId", "handle");
CREATE INDEX "Blog_storeId_createdAt_idx" ON "Blog"("storeId", "createdAt");
CREATE UNIQUE INDEX "Article_blogId_handle_key" ON "Article"("blogId", "handle");
CREATE INDEX "Article_storeId_publishedAt_idx" ON "Article"("storeId", "publishedAt");
CREATE INDEX "Article_blogId_publishedAt_idx" ON "Article"("blogId", "publishedAt");

ALTER TABLE "Blog" ADD CONSTRAINT "Blog_storeId_fkey" FOREIGN KEY ("storeId") REFERENCES "Store"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "Article" ADD CONSTRAINT "Article_storeId_fkey" FOREIGN KEY ("storeId") REFERENCES "Store"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "Article" ADD CONSTRAINT "Article_blogId_fkey" FOREIGN KEY ("blogId") REFERENCES "Blog"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- One "News" blog per store that had any blog content.
INSERT INTO "Blog" ("id", "storeId", "title", "handle", "updatedAt")
SELECT 'blog_' || s."storeId", s."storeId", 'News', 'news', CURRENT_TIMESTAMP
FROM (SELECT "storeId" FROM "BlogPost" UNION SELECT "storeId" FROM "BlogCategory") s;

INSERT INTO "Article" ("id", "storeId", "blogId", "title", "handle", "excerpt", "body", "tags", "imageUrl", "imageAlt",
                       "authorId", "authorName", "publishedAt", "seoTitle", "seoDescription", "readingMinutes", "createdAt", "updatedAt")
SELECT p."id", p."storeId", 'blog_' || p."storeId", p."title", p."slug", p."excerpt", p."body",
       CASE
         WHEN c."name" IS NULL OR c."name" = ANY (p."tags") THEN p."tags"
         ELSE p."tags" || c."name"
       END,
       p."featuredImage", p."featuredImageAlt", p."authorId", p."authorName",
       CASE WHEN p."status" = 'DRAFT' THEN NULL ELSE p."publishedAt" END,
       p."seoTitle", p."seoDescription", p."readingMinutes", p."createdAt", p."updatedAt"
FROM "BlogPost" p
LEFT JOIN "BlogCategory" c ON c."id" = p."categoryId";

DROP TABLE "BlogPost";
DROP TABLE "BlogCategory";
DROP TYPE "BlogPostStatus";
