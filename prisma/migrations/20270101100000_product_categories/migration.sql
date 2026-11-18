-- Products can belong to several categories. Existing products keep their one category as a link.
CREATE TABLE "ProductCategory" (
  "productId" TEXT NOT NULL,
  "categoryId" TEXT NOT NULL,
  CONSTRAINT "ProductCategory_pkey" PRIMARY KEY ("productId","categoryId")
);
CREATE INDEX "ProductCategory_categoryId_idx" ON "ProductCategory"("categoryId");
ALTER TABLE "ProductCategory" ADD CONSTRAINT "ProductCategory_productId_fkey" FOREIGN KEY ("productId") REFERENCES "Product"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "ProductCategory" ADD CONSTRAINT "ProductCategory_categoryId_fkey" FOREIGN KEY ("categoryId") REFERENCES "Category"("id") ON DELETE CASCADE ON UPDATE CASCADE;
INSERT INTO "ProductCategory" ("productId","categoryId") SELECT "id","categoryId" FROM "Product" WHERE "categoryId" IS NOT NULL;
