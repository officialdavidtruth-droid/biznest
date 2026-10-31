-- Archived products (deleted but kept for order/stock history) get their own state
-- instead of looking like drafts, and stop counting toward the plan product limit.
ALTER TABLE "Product" ADD COLUMN "archivedAt" TIMESTAMP(3);

-- Existing "archived" rows were just unpublished; they can't be told apart from
-- drafts, so they are left as drafts. Only products archived from now on get the flag.
CREATE INDEX "Product_storeId_archivedAt_idx" ON "Product"("storeId", "archivedAt");
