-- One profile per person per store.
--
-- Without these, concurrent POS sales, storefront signup and account pages could
-- each create their own profile for the same customer, splitting their history
-- in Customer 360. These are partial unique indexes (raw SQL, like the existing
-- partial index on "User"); Prisma's schema language cannot express them.
--
-- Run `npx tsx prisma/backfill-customer-phones.ts --apply` and
-- `npx tsx prisma/merge-duplicate-customer-profiles.ts --apply` BEFORE this
-- migration on any database that already has data. If duplicates remain, the
-- check below stops the migration with a clear message instead of a bare
-- index-creation error, and nothing is changed (Postgres DDL is transactional).

DO $$
DECLARE
  dup_email integer;
  dup_phone integer;
  dup_user integer;
BEGIN
  SELECT count(*) INTO dup_email FROM (
    SELECT 1 FROM "StoreCustomerProfile"
    WHERE "email" IS NOT NULL AND "email" <> ''
    GROUP BY "storeId", lower("email") HAVING count(*) > 1
  ) d;
  SELECT count(*) INTO dup_phone FROM (
    SELECT 1 FROM "StoreCustomerProfile"
    WHERE "phone" IS NOT NULL AND "phone" <> ''
    GROUP BY "storeId", "phone" HAVING count(*) > 1
  ) d;
  SELECT count(*) INTO dup_user FROM (
    SELECT 1 FROM "StoreCustomerProfile"
    WHERE "userId" IS NOT NULL
    GROUP BY "storeId", "userId" HAVING count(*) > 1
  ) d;

  IF dup_email > 0 OR dup_phone > 0 OR dup_user > 0 THEN
    RAISE EXCEPTION 'Duplicate StoreCustomerProfile rows exist (% by email, % by phone, % by user). Run prisma/backfill-customer-phones.ts --apply, then prisma/merge-duplicate-customer-profiles.ts, then re-run this migration.',
      dup_email, dup_phone, dup_user;
  END IF;
END $$;

CREATE UNIQUE INDEX "StoreCustomerProfile_storeId_email_key"
  ON "StoreCustomerProfile" ("storeId", lower("email"))
  WHERE "email" IS NOT NULL AND "email" <> '';

CREATE UNIQUE INDEX "StoreCustomerProfile_storeId_phone_key"
  ON "StoreCustomerProfile" ("storeId", "phone")
  WHERE "phone" IS NOT NULL AND "phone" <> '';

CREATE UNIQUE INDEX "StoreCustomerProfile_storeId_userId_key"
  ON "StoreCustomerProfile" ("storeId", "userId")
  WHERE "userId" IS NOT NULL;
