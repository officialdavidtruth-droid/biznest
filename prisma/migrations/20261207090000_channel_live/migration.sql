-- Live two-way channel link: inbound webhook, signed availability push, outbox.
ALTER TABLE "ChannelConnection"
  ADD COLUMN "hookToken" TEXT,
  ADD COLUMN "liveSecret" TEXT,
  ADD COLUMN "pushUrl" TEXT,
  ADD COLUMN "pushSeq" INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN "lastPushAt" TIMESTAMP(3),
  ADD COLUMN "lastPushStatus" TEXT,
  ADD COLUMN "lastPushMessage" TEXT,
  ADD COLUMN "lastHookAt" TIMESTAMP(3);

CREATE UNIQUE INDEX "ChannelConnection_hookToken_key" ON "ChannelConnection"("hookToken");

CREATE TABLE "ChannelPush" (
  "id" TEXT NOT NULL,
  "storeId" TEXT NOT NULL,
  "connectionId" TEXT NOT NULL,
  "seq" INTEGER NOT NULL,
  "payload" TEXT NOT NULL,
  "status" TEXT NOT NULL DEFAULT 'PENDING',
  "attempts" INTEGER NOT NULL DEFAULT 0,
  "nextAttemptAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "lastError" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "sentAt" TIMESTAMP(3),
  CONSTRAINT "ChannelPush_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "ChannelPush_status_nextAttemptAt_idx" ON "ChannelPush"("status", "nextAttemptAt");
CREATE INDEX "ChannelPush_connectionId_status_idx" ON "ChannelPush"("connectionId", "status");
CREATE INDEX "ChannelPush_storeId_idx" ON "ChannelPush"("storeId");

ALTER TABLE "ChannelPush" ADD CONSTRAINT "ChannelPush_connectionId_fkey"
  FOREIGN KEY ("connectionId") REFERENCES "ChannelConnection"("id") ON DELETE CASCADE ON UPDATE CASCADE;
