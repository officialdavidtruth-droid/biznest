-- Checkout idempotency. A duplicate submission of the same checkout
-- attempt (double-click, a client retry after a slow response, a
-- back-button resubmit, or two genuinely simultaneous submissions) must
-- never create a second order or charge the customer twice. See the
-- dedupe guard in startCheckout (lib/actions/order.ts).

-- AlterTable
-- IF NOT EXISTS: a prior deploy attempt may have partially applied this
-- migration (added the columns, then failed before recording success),
-- so re-running must not error on columns/index that already exist.
ALTER TABLE "Order" ADD COLUMN IF NOT EXISTS "idempotencyKey" TEXT;
ALTER TABLE "Order" ADD COLUMN IF NOT EXISTS "checkoutUrl" TEXT;

-- CreateIndex
-- Nullable+unique: Postgres allows multiple NULLs in a unique index, so
-- every non-storefront-checkout Order (POS sales, etc) simply leaves this
-- null without conflicting with any other order.
CREATE UNIQUE INDEX IF NOT EXISTS "Order_idempotencyKey_key" ON "Order"("idempotencyKey");
