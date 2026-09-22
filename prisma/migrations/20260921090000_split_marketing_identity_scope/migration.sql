-- BizNest Marketing is a fully separate product from the main BizNest
-- storefront platform (separate accounts, separate subscription, separate
-- everything -- see lib/access/marketing-tool.ts). Previously both a main
-- platform signup (registerUser) and a Marketing signup (signUpForMarketing)
-- created a scope-null User row, and the single partial unique index from
-- 20260823120000_customer_scoped_email made those two products share one
-- global "one account per email" identity space. In practice this meant an
-- email already registered on the main platform would be rejected as
-- "already exists" when trying to sign up for Marketing, even though the
-- two are supposed to be totally independent accounts.
--
-- This migration adds an isMarketingOnly flag and splits the old single
-- scope-null partial unique index into two -- one per product -- so a main
-- platform account and a Marketing account can independently exist for the
-- same email, while each product's accounts stay unique among themselves,
-- same as before.

-- 1. Add the new flag column. Existing scope-null rows are all main
--    platform accounts (Marketing signup didn't previously set anything
--    that would distinguish it), so defaulting to false is correct for
--    backfill.
ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "isMarketingOnly" BOOLEAN NOT NULL DEFAULT false;

-- 2. Drop the old single scope-null partial unique index.
DROP INDEX IF EXISTS "User_email_platform_scope_unique";

-- 3. Recreate it as two indexes, one per product, so each is unique among
--    its own accounts without colliding with the other's.
CREATE UNIQUE INDEX IF NOT EXISTS "User_email_platform_scope_unique"
  ON "User" (email)
  WHERE "customerScopeStoreId" IS NULL AND "isMarketingOnly" = false;

CREATE UNIQUE INDEX IF NOT EXISTS "User_email_marketing_scope_unique"
  ON "User" (email)
  WHERE "customerScopeStoreId" IS NULL AND "isMarketingOnly" = true;
