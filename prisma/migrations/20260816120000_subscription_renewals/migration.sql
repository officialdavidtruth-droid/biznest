-- Recurring billing state for Store subscriptions (see app/api/cron/subscription-renewals).
-- All nullable/additive: existing stores default to "not yet on recurring billing" until
-- their next successful checkout populates these.
ALTER TYPE "PaymentPurpose" ADD VALUE IF NOT EXISTS 'SUBSCRIPTION_RENEWAL';

ALTER TABLE "Store" ADD COLUMN "paystackAuthorizationCode" TEXT;
ALTER TABLE "Store" ADD COLUMN "subscriptionRenewsAt" TIMESTAMP(3);
ALTER TABLE "Store" ADD COLUMN "subscriptionPastDueSince" TIMESTAMP(3);

-- Renewal cron scans for stores due soon / overdue -- index keeps that scan cheap
-- as the store count grows instead of a full table scan every run.
CREATE INDEX "Store_subscriptionRenewsAt_idx" ON "Store"("subscriptionRenewsAt");
