-- Alternate ownership-verification path: a code emailed to an address at
-- the domain being connected, for account owners who can't edit their
-- site's code/files (e.g. no developer access) but do control company email.
ALTER TABLE "MarketingWebsiteConnection" ADD COLUMN IF NOT EXISTS "emailCode" TEXT;
ALTER TABLE "MarketingWebsiteConnection" ADD COLUMN IF NOT EXISTS "emailCodeSentTo" TEXT;
ALTER TABLE "MarketingWebsiteConnection" ADD COLUMN IF NOT EXISTS "emailCodeExpiresAt" TIMESTAMP(3);
