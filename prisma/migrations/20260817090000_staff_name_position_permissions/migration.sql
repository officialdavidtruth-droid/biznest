-- Adds the fields shown on the invite screen and admin staff list: the
-- invited person's name, their position/job title, and a checklist of
-- which parts of the dashboard they've been given access to. `permissions`
-- is informational/display-only for now (dashboard access is still gated
-- by `role`); see lib/access/staff-permissions.ts for the canonical list.

ALTER TABLE "StoreStaff" ADD COLUMN "invitedName" TEXT;
ALTER TABLE "StoreStaff" ADD COLUMN "position" TEXT;
ALTER TABLE "StoreStaff" ADD COLUMN "permissions" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[];
