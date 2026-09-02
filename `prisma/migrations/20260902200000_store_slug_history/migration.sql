-- Records every slug a store used to have, so a bookmarked/shared link
-- (biznest.space/<old-slug>) keeps resolving after the owner shortens or
-- renames their storefront URL (see updateStoreSlug in
-- lib/actions/store.ts). oldSlug is unique so a retired slug can never be
-- reassigned to a different store while it's still acting as a redirect
-- target for this one.
CREATE TABLE "StoreSlugHistory" (
  "id" TEXT NOT NULL,
  "storeId" TEXT NOT NULL,
  "oldSlug" TEXT NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "StoreSlugHistory_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "StoreSlugHistory_oldSlug_key" ON "StoreSlugHistory"("oldSlug");
CREATE INDEX "StoreSlugHistory_storeId_idx" ON "StoreSlugHistory"("storeId");
ALTER TABLE "StoreSlugHistory" ADD CONSTRAINT "StoreSlugHistory_storeId_fkey" FOREIGN KEY ("storeId") REFERENCES "Store"("id") ON DELETE CASCADE ON UPDATE CASCADE;
