-- Staff accounts: non-owner users with scoped access to a store's dashboard.
-- See lib/access/store-access.ts for the single ownership/role-check helper
-- and lib/actions/staff.ts for the invite/accept/revoke flow.

CREATE TYPE "StaffRole" AS ENUM ('MANAGER', 'STAFF');
CREATE TYPE "StaffInviteStatus" AS ENUM ('PENDING', 'ACTIVE', 'REVOKED');

CREATE TABLE "StoreStaff" (
    "id" TEXT NOT NULL,
    "storeId" TEXT NOT NULL,
    "invitedEmail" TEXT NOT NULL,
    "userId" TEXT,
    "role" "StaffRole" NOT NULL DEFAULT 'STAFF',
    "status" "StaffInviteStatus" NOT NULL DEFAULT 'PENDING',
    "inviteToken" TEXT NOT NULL,
    "invitedByUserId" TEXT NOT NULL,
    "invitedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "acceptedAt" TIMESTAMP(3),

    CONSTRAINT "StoreStaff_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "StoreStaff_inviteToken_key" ON "StoreStaff"("inviteToken");
CREATE UNIQUE INDEX "StoreStaff_storeId_invitedEmail_key" ON "StoreStaff"("storeId", "invitedEmail");
CREATE INDEX "StoreStaff_userId_idx" ON "StoreStaff"("userId");
CREATE INDEX "StoreStaff_inviteToken_idx" ON "StoreStaff"("inviteToken");

ALTER TABLE "StoreStaff" ADD CONSTRAINT "StoreStaff_storeId_fkey"
  FOREIGN KEY ("storeId") REFERENCES "Store"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "StoreStaff" ADD CONSTRAINT "StoreStaff_userId_fkey"
  FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
