-- Observability: one row per notable event (caught exception, slow request,
-- bounced email, dead webhook, failed login, etc.) across the categories
-- shown on /supaadmin/system-health. See lib/observability/log.ts for the
-- write path -- deliberately a single generic table rather than one per
-- subsystem, since volume here is "hundreds/day" not "millions/day"; a
-- proper APM is the right call past this scale.

CREATE TYPE "EventCategory" AS ENUM ('DATABASE', 'PAYMENTS', 'EMAIL', 'WEBHOOKS', 'STORAGE', 'AUTH', 'API', 'JOBS');
CREATE TYPE "EventLevel" AS ENUM ('INFO', 'WARN', 'ERROR');

CREATE TABLE "SystemEvent" (
    "id" TEXT NOT NULL,
    "category" "EventCategory" NOT NULL,
    "level" "EventLevel" NOT NULL,
    "message" TEXT NOT NULL,
    "metadata" JSONB,
    "durationMs" INTEGER,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "SystemEvent_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "SystemEvent_category_createdAt_idx" ON "SystemEvent"("category", "createdAt");
CREATE INDEX "SystemEvent_level_createdAt_idx" ON "SystemEvent"("level", "createdAt");
