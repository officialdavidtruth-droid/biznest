-- CreateIndex
CREATE INDEX IF NOT EXISTS "Conversation_storeId_idx" ON "Conversation"("storeId");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "Message_conversationId_createdAt_idx" ON "Message"("conversationId", "createdAt");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "Message_conversationId_readAt_idx" ON "Message"("conversationId", "readAt");
