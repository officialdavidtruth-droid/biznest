ALTER TABLE "WishlistItem" ADD COLUMN "storeId" TEXT;
ALTER TABLE "RecentlyViewed" ADD COLUMN "storeId" TEXT;
ALTER TABLE "FavoriteBusiness" ADD COLUMN "storeId" TEXT;

UPDATE "WishlistItem" w SET "storeId" = p."storeId" FROM "Product" p WHERE w."productId" = p."id" AND w."storeId" IS NULL;
UPDATE "WishlistItem" w SET "storeId" = s."storeId" FROM "Service" s WHERE w."serviceId" = s."id" AND w."storeId" IS NULL;
UPDATE "RecentlyViewed" r SET "storeId" = p."storeId" FROM "Product" p WHERE r."productId" = p."id" AND r."storeId" IS NULL;
UPDATE "RecentlyViewed" r SET "storeId" = s."storeId" FROM "Service" s WHERE r."serviceId" = s."id" AND r."storeId" IS NULL;
UPDATE "FavoriteBusiness" f SET "storeId" = st."id" FROM "Business" b JOIN "Store" st ON st."businessId" = b."id" WHERE f."businessId" = b."id" AND f."storeId" IS NULL;

DELETE FROM "WishlistItem" WHERE "storeId" IS NULL;
DELETE FROM "RecentlyViewed" WHERE "storeId" IS NULL;
DELETE FROM "FavoriteBusiness" WHERE "storeId" IS NULL;

ALTER TABLE "WishlistItem" ALTER COLUMN "storeId" SET NOT NULL;
ALTER TABLE "RecentlyViewed" ALTER COLUMN "storeId" SET NOT NULL;
ALTER TABLE "FavoriteBusiness" ALTER COLUMN "storeId" SET NOT NULL;

CREATE INDEX "WishlistItem_storeId_idx" ON "WishlistItem"("storeId");
CREATE INDEX "RecentlyViewed_storeId_idx" ON "RecentlyViewed"("storeId");
CREATE INDEX "FavoriteBusiness_storeId_idx" ON "FavoriteBusiness"("storeId");
ALTER TABLE "WishlistItem" ADD CONSTRAINT "WishlistItem_storeId_fkey" FOREIGN KEY ("storeId") REFERENCES "Store"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "RecentlyViewed" ADD CONSTRAINT "RecentlyViewed_storeId_fkey" FOREIGN KEY ("storeId") REFERENCES "Store"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "FavoriteBusiness" ADD CONSTRAINT "FavoriteBusiness_storeId_fkey" FOREIGN KEY ("storeId") REFERENCES "Store"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Preserve legacy address books only when the customer has exactly one store
-- membership. Customers with multiple memberships are intentionally left
-- empty rather than copying a private address into another store.
INSERT INTO "StoreCustomerAddress" ("id", "storeId", "userId", "label", "fullName", "phone", "line1", "line2", "city", "state", "country", "isDefault", "createdAt")
SELECT gen_random_uuid()::text, sc."storeId", a."userId", a."label", a."fullName", a."phone", a."line1", a."line2", a."city", a."state", a."country", a."isDefault", a."createdAt"
FROM "Address" a
JOIN "StoreCustomer" sc ON sc."userId" = a."userId"
WHERE (SELECT COUNT(*) FROM "StoreCustomer" sc2 WHERE sc2."userId" = a."userId") = 1;
