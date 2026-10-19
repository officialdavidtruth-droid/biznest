-- Marks stores whose legacy gateway subaccount no longer takes a platform percentage.
ALTER TABLE "Store" ADD COLUMN "legacySplitZeroedAt" TIMESTAMP(3);
