-- Admin-set staff login handle. Staff now get a username + password set
-- directly by the admin at invite time (paired with the store slug for
-- login, e.g. "amaka@my-store") instead of self-registering through the
-- accept-invite flow with their own email/password.

-- AlterTable
ALTER TABLE "StoreStaff" ALTER COLUMN "invitedEmail" DROP NOT NULL;
ALTER TABLE "StoreStaff" ADD COLUMN IF NOT EXISTS "username" TEXT;

-- CreateIndex
CREATE UNIQUE INDEX IF NOT EXISTS "StoreStaff_storeId_username_key" ON "StoreStaff"("storeId", "username");
