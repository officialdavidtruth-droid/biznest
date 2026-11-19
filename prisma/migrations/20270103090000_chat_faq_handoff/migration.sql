-- Customer chat: FAQ topics, human-agent requests and automated replies.
ALTER TABLE "Store" ADD COLUMN IF NOT EXISTS "messagingConfig" JSONB;
ALTER TABLE "Conversation" ADD COLUMN IF NOT EXISTS "topic" TEXT;
ALTER TABLE "Conversation" ADD COLUMN IF NOT EXISTS "needsHuman" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "Conversation" ADD COLUMN IF NOT EXISTS "humanRequestedAt" TIMESTAMP(3);
ALTER TABLE "Message" ADD COLUMN IF NOT EXISTS "isAutomated" BOOLEAN NOT NULL DEFAULT false;
CREATE INDEX IF NOT EXISTS "Conversation_storeId_needsHuman_idx" ON "Conversation"("storeId", "needsHuman");
