-- Gateway fee held back from the vendor on each payout (existing payouts: 0, paid in full).
ALTER TABLE "Payout" ADD COLUMN "feeAmount" DECIMAL(12,2) NOT NULL DEFAULT 0;
