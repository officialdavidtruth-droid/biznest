-- Invoice/quote numbers are built from the first 12 chars of the store slug plus a
-- per-store counter, so two stores with a shared slug prefix could collide on the
-- old global unique index. Uniqueness is now per store.
DROP INDEX IF EXISTS "Invoice_invoiceNo_key";
DROP INDEX IF EXISTS "Quote_quoteNo_key";
CREATE UNIQUE INDEX "Invoice_storeId_invoiceNo_key" ON "Invoice"("storeId", "invoiceNo");
CREATE UNIQUE INDEX "Quote_storeId_quoteNo_key" ON "Quote"("storeId", "quoteNo");
