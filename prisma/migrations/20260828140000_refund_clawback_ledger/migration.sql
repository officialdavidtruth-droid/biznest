-- Refund clawback ledger: tracks merchant-share amounts the platform
-- fronted on refunds issued after a split had already settled to the
-- merchant (Paystack confirmed they don't auto-reclaim in that case).
-- Mirrors the existing posCommissionOwed / PosCommissionSettlement pattern.

ALTER TABLE "Store" ADD COLUMN IF NOT EXISTS "refundClawbackOwed" DECIMAL(12,2) NOT NULL DEFAULT 0;

CREATE TABLE "StoreRefundClawback" (
    "id" TEXT NOT NULL,
    "storeId" TEXT NOT NULL,
    "paymentId" TEXT NOT NULL,
    "amount" DECIMAL(12,2) NOT NULL,
    "reason" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "StoreRefundClawback_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "StoreRefundClawback_paymentId_key" ON "StoreRefundClawback"("paymentId");
CREATE INDEX "StoreRefundClawback_storeId_createdAt_idx" ON "StoreRefundClawback"("storeId", "createdAt");
CREATE INDEX "StoreRefundClawback_paymentId_idx" ON "StoreRefundClawback"("paymentId");

ALTER TABLE "StoreRefundClawback" ADD CONSTRAINT "StoreRefundClawback_storeId_fkey"
  FOREIGN KEY ("storeId") REFERENCES "Store"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "StoreRefundClawback" ADD CONSTRAINT "StoreRefundClawback_paymentId_fkey"
  FOREIGN KEY ("paymentId") REFERENCES "Payment"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

CREATE TABLE "RefundClawbackSettlement" (
    "id" TEXT NOT NULL,
    "storeId" TEXT NOT NULL,
    "amount" DECIMAL(12,2) NOT NULL,
    "note" TEXT,
    "settledByEmail" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "RefundClawbackSettlement_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "RefundClawbackSettlement_storeId_createdAt_idx" ON "RefundClawbackSettlement"("storeId", "createdAt");

ALTER TABLE "RefundClawbackSettlement" ADD CONSTRAINT "RefundClawbackSettlement_storeId_fkey"
  FOREIGN KEY ("storeId") REFERENCES "Store"("id") ON DELETE CASCADE ON UPDATE CASCADE;
