-- Post-to-room: remember which invoice/POS order a folio charge came from (additive, nullable).
ALTER TABLE "PropertyFolioCharge" ADD COLUMN "sourceType" TEXT;
ALTER TABLE "PropertyFolioCharge" ADD COLUMN "sourceId" TEXT;
CREATE INDEX "PropertyFolioCharge_storeId_sourceType_sourceId_idx" ON "PropertyFolioCharge"("storeId", "sourceType", "sourceId");
