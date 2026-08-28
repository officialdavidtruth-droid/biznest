-- Split "connected a payout account" from "gateway verified that account".
-- payoutVerifiedAt was previously stamped at connection time (a bug — see
-- lib/actions/store.ts connectPayoutAccount), so every existing row's
-- payoutVerifiedAt actually only ever meant "connected." Preserve that as
-- payoutConnectedAt, then null out payoutVerifiedAt so it stops falsely
-- reporting KYC-verified until refreshPayoutVerification confirms it for
-- real against Paystack.

ALTER TABLE "Store" ADD COLUMN IF NOT EXISTS "payoutConnectedAt" TIMESTAMP(3);

UPDATE "Store" SET "payoutConnectedAt" = "payoutVerifiedAt" WHERE "payoutVerifiedAt" IS NOT NULL;

UPDATE "Store" SET "payoutVerifiedAt" = NULL;
