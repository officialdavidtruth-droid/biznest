-- Pre-orders: sell a product before stock exists, with an expected ship date and an optional cap. Additive only.
ALTER TABLE "Product" ADD COLUMN "preorderEnabled" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "Product" ADD COLUMN "preorderShipsOn" DATE;
ALTER TABLE "Product" ADD COLUMN "preorderLimit" INTEGER;
-- Snapshot on the order line, so a later change to the product never rewrites what a customer was promised.
ALTER TABLE "OrderItem" ADD COLUMN "preorder" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "OrderItem" ADD COLUMN "preorderShipsOn" DATE;
