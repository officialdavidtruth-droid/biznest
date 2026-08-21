-- Checkout idempotency. A duplicate submission of the same checkout
-- attempt (double-click, a client retry after a slow response, a
-- back-button resubmit, or two genuinely simultaneous submissions) must
-- never create a second order or charge the customer twice. See the
-- dedupe guard in startCheckout (lib/actions/order.ts).

-- AlterTable
ALTER TABLE "Order" ADD COLUMN "idempotencyKey" TEXT;
ALTER TABLE "Order" ADD COLUMN "checkoutUrl" TEXT;

-- CreateIndex
-- Nullable+unique: Postgres allows multiple NULLs in a unique index, so
-- every non-storefront-checkout Order (POS sales, etc) simply leaves this
-- null without conflicting with any other order.
CREATE UNIQUE INDEX "Order_idempotencyKey_key" ON "Order"("idempotencyKey");
