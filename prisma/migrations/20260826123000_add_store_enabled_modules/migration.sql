-- Add the missing Store.enabledModules column.
-- Same root cause as the businessType migration before this one: the
-- field has existed in prisma/schema.prisma for a while but no migration
-- was ever generated for it, so the deployed database never got the
-- column ("column Store.enabledModules does not exist").
--
-- Nullable JSON column, so no backfill is required -- existing rows will
-- just read as NULL until re-saved (lib/actions/store.ts sets it going
-- forward).

ALTER TABLE "Store" ADD COLUMN "enabledModules" JSONB;
