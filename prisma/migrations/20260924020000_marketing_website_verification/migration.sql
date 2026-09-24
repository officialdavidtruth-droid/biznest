-- Add ownership-verification fields to MarketingWebsiteConnection.
ALTER TABLE "MarketingWebsiteConnection" ADD COLUMN IF NOT EXISTS "websiteHost" TEXT;
ALTER TABLE "MarketingWebsiteConnection" ADD COLUMN IF NOT EXISTS "verificationToken" TEXT;
ALTER TABLE "MarketingWebsiteConnection" ADD COLUMN IF NOT EXISTS "verifiedAt" TIMESTAMP(3);
ALTER TABLE "MarketingWebsiteConnection" ADD COLUMN IF NOT EXISTS "lastAttemptAt" TIMESTAMP(3);

-- Backfill any rows connected before verification existed: derive the host
-- from the stored URL and issue them a fresh token. These previously-
-- unverified connections are moved back to PENDING_VERIFICATION so no
-- unverified site keeps "CONNECTED" status once this ships.
UPDATE "MarketingWebsiteConnection"
SET "websiteHost" = lower(regexp_replace(regexp_replace("websiteUrl", '^https?://', ''), '/.*$', '')),
    "verificationToken" = md5(random()::text || "id" || clock_timestamp()::text),
    "status" = 'PENDING_VERIFICATION'
WHERE "websiteHost" IS NULL;

ALTER TABLE "MarketingWebsiteConnection" ALTER COLUMN "websiteHost" SET NOT NULL;
ALTER TABLE "MarketingWebsiteConnection" ALTER COLUMN "verificationToken" SET NOT NULL;
ALTER TABLE "MarketingWebsiteConnection" ALTER COLUMN "status" SET DEFAULT 'PENDING_VERIFICATION';

-- Guard against a pre-existing collision (two accounts already scanned the
-- same domain before this constraint existed): keep the newest row's claim
-- on the host and rename the older duplicate(s) so the unique index below
-- can be created; those older rows will simply fail re-verification.
UPDATE "MarketingWebsiteConnection" t
SET "websiteHost" = t."websiteHost" || '#dup-' || t."id"
WHERE t."id" NOT IN (
  SELECT DISTINCT ON ("websiteHost") "id" FROM "MarketingWebsiteConnection" ORDER BY "websiteHost", "updatedAt" DESC
);

-- A domain can only ever be claimed by one BizNest Marketing account.
CREATE UNIQUE INDEX IF NOT EXISTS "MarketingWebsiteConnection_websiteHost_key" ON "MarketingWebsiteConnection"("websiteHost");
