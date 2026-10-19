-- The AbandonedCheckoutNotification model, NotificationChannel and
-- NotificationStatus enums were added to schema.prisma without a migration,
-- so /admin/abandoned-checkouts (which includes `abandonedNotifications`)
-- threw on any database built via `prisma migrate deploy`. Idempotent so it
-- is also safe where the objects were created manually / via db push.

DO $$ BEGIN
  CREATE TYPE "NotificationChannel" AS ENUM ('EMAIL', 'WHATSAPP', 'SMS');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE TYPE "NotificationStatus" AS ENUM ('SENT', 'FAILED');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

CREATE TABLE IF NOT EXISTS "AbandonedCheckoutNotification" (
  "id" TEXT NOT NULL,
  "orderId" TEXT NOT NULL,
  "channel" "NotificationChannel" NOT NULL,
  "status" "NotificationStatus" NOT NULL,
  "error" TEXT,
  "sentAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "AbandonedCheckoutNotification_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "AbandonedCheckoutNotification_orderId_idx" ON "AbandonedCheckoutNotification"("orderId");

DO $$ BEGIN
  ALTER TABLE "AbandonedCheckoutNotification"
    ADD CONSTRAINT "AbandonedCheckoutNotification_orderId_fkey"
    FOREIGN KEY ("orderId") REFERENCES "Order"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;
