# BizNest Messages page fixes (problems 1-12a)

Copy each file to the same path in your project (paths are relative to the project root).

| Path | Status | Fixes |
|---|---|---|
| components/dashboard/admin-message-thread.tsx | replace | 1 double-send, 2 stuck button, 6 scroll to newest, 7 line breaks/long text, 8 staff labels, 9 length cap + counter, 11 smart scroll |
| components/dashboard/auto-refresh.tsx | NEW | 11 auto-refresh every 15s |
| lib/actions/account.ts | replace | 3 duplicate general thread, 5 notify staff via helper, 9 length + rate limit (customer side) |
| lib/actions/store-messages.ts | replace | 4 unread + read-on-open, 8 fromStore flag, 9 limits, 10 pagination, 12a denied state |
| lib/message-limits.ts | NEW | 9 limits constants, 10 page size |
| lib/notifications/notify.ts | replace | 5 notifyStoreOfCustomerMessage |
| app/store/[slug]/admin/messages/page.tsx | replace | 4 badges/time, 10 pagination, 11 auto-refresh, 12a no-access state |
| app/store/[slug]/admin/messages/[id]/page.tsx | replace | 11 auto-refresh |
| prisma/migrations/20261105100000_message_conversation_index/migration.sql | NEW | 10 Message index |

## Manual step: prisma/schema.prisma
Add inside model Conversation (after createdAt):   @@index([storeId])
Add inside model Message (after createdAt):        @@index([conversationId, createdAt])
(see schema-indexes.diff)

## Notes
- account.ts, notify.ts and store-messages.ts are full files from your upload with only my changes; if you edited them since, merge instead of replacing.
- Optional one-off SQL to avoid every old thread showing as unread: see problem 4 in the chat.
