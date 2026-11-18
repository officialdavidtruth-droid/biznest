-- A plan can now be paid monthly or yearly (15% off for 12 months). Existing stores were all billed monthly.
ALTER TABLE "Store" ADD COLUMN IF NOT EXISTS "subscriptionBillingPeriod" TEXT NOT NULL DEFAULT 'MONTHLY';
