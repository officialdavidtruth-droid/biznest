-- Allow the same email to independently register as a completely separate
-- customer account at every store, while keeping platform-level accounts
-- (store owners, staff, platform admins) globally unique by email as before.
--
-- Previously "User.email" had a single global UNIQUE constraint. This
-- migration replaces it with two mechanisms working together:
--   1. customerScopeStoreId column: NULL for platform-level identities,
--      or a specific store's id for a customer account scoped to that
--      store only.
--   2. A composite unique index on (email, "customerScopeStoreId") --
--      handles per-store uniqueness for customer rows (Prisma-managed,
--      declared in schema.prisma as @@unique).
--   3. A partial unique index (this file only -- Prisma's schema DSL has
--      no way to express a WHERE-scoped unique index) that keeps
--      scope-null rows globally unique, since Postgres treats every NULL
--      as distinct and the composite index above would otherwise allow
--      duplicate platform accounts sharing an email.

-- 1. Drop the old global unique constraint on email. Name may vary
--    depending on how the original migration created it, so try both the
--    conventional Prisma constraint name and a defensive index-name
--    fallback.
ALTER TABLE "User" DROP CONSTRAINT IF EXISTS "User_email_key";
DROP INDEX IF EXISTS "User_email_key";

-- 2. Add the new scope column + FK to Store.
ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "customerScopeStoreId" TEXT;

ALTER TABLE "User"
  ADD CONSTRAINT "User_customerScopeStoreId_fkey"
  FOREIGN KEY ("customerScopeStoreId") REFERENCES "Store"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;

-- 3. Composite unique index: unique email within each store scope.
CREATE UNIQUE INDEX IF NOT EXISTS "User_email_customerScopeStoreId_key"
  ON "User" ("email", "customerScopeStoreId");

-- 4. Partial unique index: unique email among platform-level (scope-null)
--    accounts specifically, restoring the old "one owner/staff/admin
--    account per email" guarantee that the composite index above can't
--    provide on its own.
CREATE UNIQUE INDEX IF NOT EXISTS "User_email_platform_scope_unique"
  ON "User" (email)
  WHERE "customerScopeStoreId" IS NULL;