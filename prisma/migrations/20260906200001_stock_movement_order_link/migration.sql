-- Link automatic SALE stock movements to their source order so stock
-- decrementing is independently replay-safe.
ALTER TABLE "StockMovement" ADD COLUMN IF NOT EXISTS "orderId" TEXT;

CREATE INDEX IF NOT EXISTS "StockMovement_orderId_idx"
  ON "StockMovement"("orderId");

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'StockMovement_orderId_fkey'
  ) THEN
    ALTER TABLE "StockMovement"
      ADD CONSTRAINT "StockMovement_orderId_fkey"
      FOREIGN KEY ("orderId") REFERENCES "Order"("id")
      ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
END $$;
