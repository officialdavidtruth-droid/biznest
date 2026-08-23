# BizNest Production Readiness

## Deployment rules

- `npm run build` runs `prisma generate`, `prisma migrate deploy`, and `next build`.
- Production builds do **not** seed demo data.
- Use `npm run db:seed:all` only in a deliberate development/demo environment.
- Do not use `prisma db push` against production.
- Do not manually resolve a migration as rolled back unless the migration has actually failed and the database state has been verified.

## Required production configuration

- `DATABASE_URL` — pooled PostgreSQL connection.
- `DIRECT_URL` — direct PostgreSQL connection used by Prisma migrations.
- `AUTH_SECRET` — strong random secret.
- `AUTH_URL` / `NEXT_PUBLIC_APP_URL` — canonical production URL.
- `ADMIN_PIN_SECRET` and `ADMIN_PIN` — platform admin protection.
- Payment provider secrets and webhook configuration for the providers you enable.
- `CRON_SECRET` — required for all cron endpoints.

## Health checks

- `GET /api/health` — liveness.
- `GET /api/health/ready` — database readiness; returns HTTP 503 when the database cannot be reached.

## Authentication hardening

- Credential sign-in is protected by IP and identifier rate limits.
- Per-account failed-login lockout remains enabled.
- Password reset is rate-limited by both IP and account.
- Password reset invalidates existing sessions.

## Payments

Payment webhooks must remain idempotent and must verify transactions with the payment provider before changing order/payment state.

## Before launch

- Run the full test suite in CI.
- Run TypeScript/build validation with production environment variables configured.
- Verify all Prisma migrations against a staging database first.
- Configure and test Paystack/Flutterwave webhook delivery with real test transactions.
- Verify cron endpoints from Vercel with the production `CRON_SECRET`.
- Confirm monitoring/alerts for database, payment, webhook, and authentication failures.
