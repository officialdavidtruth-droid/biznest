-- Messages were looked up by conversationId (thread view, latest-message and
-- unread-count queries in the dashboard inbox) with no supporting index.
-- Conversation_storeId_idx already exists from 20260822150000_store_customer_experience.
CREATE INDEX "Message_conversationId_createdAt_idx" ON "Message"("conversationId", "createdAt");
