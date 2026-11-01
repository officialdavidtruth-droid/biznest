# CRM & Sales fixes (1 Nov 2026)

No Prisma schema change and no new migration.

| File | Change |
|---|---|
| lib/actions/seo-crm.ts | Plan/install check in every action (H1); edit + delete lead (H2); validation, transactions, stage history, DB-backed pipeline totals, 500 open / 100 closed lead cap with notice (M1, M2, M4) |
| lib/crm-lead-input.ts (new) | Shared lead validation/normalisation |
| lib/crm-leads.ts (new) | Shared open-lead dedupe (email case-insensitive, phone) (M3) |
| lib/actions/contact.ts, lib/actions/creative-projects.ts | Use the shared dedupe helper (M3) |
| app/api/cron/crm-followups/route.ts (new), lib/observability/cron-registry.ts, vercel.json | Daily 07:00 UTC follow-up reminder, one notification per store (H3) |
| components/dashboard/crm-workspace.tsx, crm-lead-drawer.tsx | Card actions visible on mobile (H4); edit contact + delete in drawer; stage activity shown; truncation notice |
| app/store/[slug]/admin/apps/crm/page.tsx, crm/marketing/page.tsx | Message instead of blank page on access failure |
| lib/__tests__/crm-lead-input.test.ts (new) | 7 unit tests |
