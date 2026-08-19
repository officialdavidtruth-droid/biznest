-- Append-only audit trail of what staff/managers (and the owner) did
-- inside a store's dashboard. Written via logStoreActivity() in
-- lib/actions/activity.ts. This table exists in schema.prisma but was
-- never migrated, so writes/reads against it were failing silently
-- (logStoreActivity swallows errors) or throwing (listStoreActivity does not).

CREATE TABLE "StoreActivityLog" (
    "id" TEXT NOT NULL,
    "storeId" TEXT NOT NULL,
    "actorUserId" TEXT,
    "actorName" TEXT NOT NULL,
    "actorEmail" TEXT NOT NULL,
    "actorRole" TEXT NOT NULL,
    "action" TEXT NOT NULL,
    "target" TEXT,
    "metadata" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "StoreActivityLog_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "StoreActivityLog_storeId_createdAt_idx" ON "StoreActivityLog"("storeId", "createdAt");

ALTER TABLE "StoreActivityLog" ADD CONSTRAINT "StoreActivityLog_storeId_fkey"
  FOREIGN KEY ("storeId") REFERENCES "Store"("id") ON DELETE CASCADE ON UPDATE CASCADE;
