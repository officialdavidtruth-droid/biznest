-- Add the missing Store.storefrontConfig column.
-- Same root cause as businessType/enabledModules before this one: the
-- field exists in prisma/schema.prisma but no migration was ever
-- generated for it.
--
-- Nullable JSON column, so no backfill required.

ALTER TABLE "Store" ADD COLUMN "storefrontConfig" JSONB;
