-- Caches the gateway's payment-page URL from the most recent charge
-- attempt so a duplicate checkout submission (double-click, client retry,
-- back-button resubmit) can reuse it instead of starting a second charge.
-- See the dedupe check in startCheckout (lib/actions/order.ts).

-- AlterTable
ALTER TABLE "Order" ADD COLUMN "checkoutUrl" TEXT;
