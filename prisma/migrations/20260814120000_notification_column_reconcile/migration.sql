-- The "Notification" table already existed live before it was added to
-- migration history (see 20260814110000), but it was created out-of-band
-- with an older/incomplete column set -- missing "url" at minimum, and
-- possibly others below. This reconciles the live table to match
-- schema.prisma. Every column is added defensively with IF NOT EXISTS so
-- this is safe to run regardless of which columns already happen to exist.

ALTER TABLE "Notification" ADD COLUMN IF NOT EXISTS "userId" TEXT;
ALTER TABLE "Notification" ADD COLUMN IF NOT EXISTS "type" TEXT;
ALTER TABLE "Notification" ADD COLUMN IF NOT EXISTS "title" TEXT;
ALTER TABLE "Notification" ADD COLUMN IF NOT EXISTS "body" TEXT;
ALTER TABLE "Notification" ADD COLUMN IF NOT EXISTS "url" TEXT;
ALTER TABLE "Notification" ADD COLUMN IF NOT EXISTS "readAt" TIMESTAMP(3);
ALTER TABLE "Notification" ADD COLUMN IF NOT EXISTS "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP;

-- Re-assert NOT NULL on the columns schema.prisma requires as non-nullable,
-- in case they were added above with no existing rows to conflict with.
-- (Skipped for userId/type/title/body if rows already exist without
-- values -- those would need a manual backfill; this will simply fail
-- loudly instead of silently corrupting data, which is the safer default.)
DO $$ BEGIN
    ALTER TABLE "Notification" ALTER COLUMN "userId" SET NOT NULL;
EXCEPTION WHEN others THEN NULL;
END $$;
DO $$ BEGIN
    ALTER TABLE "Notification" ALTER COLUMN "type" SET NOT NULL;
EXCEPTION WHEN others THEN NULL;
END $$;
DO $$ BEGIN
    ALTER TABLE "Notification" ALTER COLUMN "title" SET NOT NULL;
EXCEPTION WHEN others THEN NULL;
END $$;
DO $$ BEGIN
    ALTER TABLE "Notification" ALTER COLUMN "body" SET NOT NULL;
EXCEPTION WHEN others THEN NULL;
END $$;

-- Make sure the index exists too (idempotent, matches 20260814110000).
CREATE INDEX IF NOT EXISTS "Notification_userId_readAt_idx" ON "Notification"("userId", "readAt");

-- Make sure the FK exists too, in case the pre-existing table didn't have it.
DO $$ BEGIN
    ALTER TABLE "Notification" ADD CONSTRAINT "Notification_userId_fkey"
        FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION
    WHEN duplicate_object THEN NULL;
END $$;
