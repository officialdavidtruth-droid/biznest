-- In-app POS (point of sale): in-person sales rung up from the dashboard
-- instead of the storefront checkout. Reuses Order/OrderItem/Payment as-is
-- (see lib/actions/pos.ts) -- this migration only adds what's needed to
-- tell a POS sale apart from an online one and to record who it was for.

-- AlterEnum
ALTER TYPE "PaymentProvider" ADD VALUE 'CASH';

-- CreateEnum
CREATE TYPE "OrderChannel" AS ENUM ('ONLINE', 'POS');

-- AlterTable
ALTER TABLE "Order" ADD COLUMN "channel" "OrderChannel" NOT NULL DEFAULT 'ONLINE';
ALTER TABLE "Order" ADD COLUMN "posTenderType" TEXT;
ALTER TABLE "Order" ADD COLUMN "posCustomerName" TEXT;
ALTER TABLE "Order" ADD COLUMN "posCustomerPhone" TEXT;
