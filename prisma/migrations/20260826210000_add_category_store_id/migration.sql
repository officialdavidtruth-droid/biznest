-- Add the missing Category.storeId column.
-- Same drift pattern as the earlier Store.businessType / enabledModules /
-- storefrontConfig migrations: this field has existed in
-- prisma/schema.prisma for a while but no migration was ever generated
-- for it, so the deployed database never got the column
-- ("column Category.storeId does not exist").
--
-- Nullable by design (see schema comment: null is retained for legacy
-- platform categories not scoped to a single store), so no backfill is
-- required and existing rows are unaffected.

ALTER TABLE "Category" ADD COLUMN "storeId" TEXT;

ALTER TABLE "Category"
  ADD CONSTRAINT "Category_storeId_fkey"
  FOREIGN KEY ("storeId") REFERENCES "Store"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;

CREATE INDEX "Category_storeId_idx" ON "Category"("storeId");
CREATE INDEX "Category_storeId_parentId_idx" ON "Category"("storeId", "parentId");

