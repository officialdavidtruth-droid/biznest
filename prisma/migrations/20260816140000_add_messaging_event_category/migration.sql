-- Schema drift fix: `MESSAGING` was added to the EventCategory enum in
-- schema.prisma (used by lib/sms/send.ts, lib/whatsapp/send.ts,
-- lib/push/send.ts) but no migration ever added it to the actual Postgres
-- enum type -- only the original 20260811130000_system_events migration
-- ran, which didn't include MESSAGING. This left the real DB enum out of
-- sync with what Prisma Client believes is valid, which crashed
-- /supaadmin/system-health (it queries every EventCategory value,
-- including MESSAGING, which Postgres then rejected as invalid enum input).
ALTER TYPE "EventCategory" ADD VALUE IF NOT EXISTS 'MESSAGING';
