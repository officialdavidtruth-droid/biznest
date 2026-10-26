# BizNest operations: monitoring, alerts, backups

Goal: you hear about a problem before a customer does.

| Layer | What it catches | Where it lives |
|---|---|---|
| Sentry | Code errors (server, browser, server actions), missed/failed crons | `instrumentation*.ts`, `lib/observability/` |
| Cron monitor | Any cron that throws, returns 5xx, or reports a real failure (e.g. all renewals failing) | `lib/observability/cron.ts` |
| Watchdog | A cron that never ran at all | `/api/cron/watchdog` (07:30 UTC daily) |
| Telegram / email alerts | Pushes the above to your phone | `lib/observability/alert.ts` |
| External uptime monitor | Site down, DB down, crons overdue (even if Vercel is the thing that broke) | UptimeRobot / Better Stack (you create the monitors, below) |
| Nightly backup + weekly restore test | Data loss, and proof the backup actually restores | `.github/workflows/db-backup.yml`, `db-restore-test.yml` |

Everything is a no-op until its env var / secret is set, so deploying this code changes nothing until you switch pieces on.

## 1. Alerts (do this first, 5 min)

1. Telegram: message **@BotFather** → `/newbot` → copy the token. Send any message to your new bot, then open `https://api.telegram.org/bot<TOKEN>/getUpdates` and copy `chat.id`.
2. Vercel → Project → Settings → Environment Variables (Production):
   - `TELEGRAM_BOT_TOKEN`, `TELEGRAM_CHAT_ID`
   - `ALERT_EMAIL` (your email; optional if Telegram is set)
   - `HEALTH_CHECK_KEY` (any long random string)
3. Redeploy.

Alerts are throttled (same problem = one message per 30-180 min), so a bad hour won't flood you.

## 2. Sentry (10 min)

1. sentry.io → new project → **Next.js** → copy the DSN.
2. Vercel env vars: `SENTRY_DSN` and `NEXT_PUBLIC_SENTRY_DSN` (same value), plus `SENTRY_ORG`, `SENTRY_PROJECT`, `SENTRY_AUTH_TOKEN` (Organization token; this uploads source maps at build so stack traces are readable).
3. Redeploy, then trigger a test error and confirm it shows up.
4. Sentry → Alerts: make sure "new issue" emails/push are on. Cron monitors appear automatically under **Crons** after the first run of each job; each is set to alert on a missed or failed run.

Sentry strips cookies, request bodies, auth headers and emails before sending.

## 3. Uptime monitors (10 min, UptimeRobot free works)

Create these HTTP monitors, 5-minute interval, alert contact = your phone (their app pushes):

| Monitor | URL | Expect |
|---|---|---|
| Site | `https://www.biznest.space/api/health` | 200 |
| Database | `https://www.biznest.space/api/health/ready` | 200 (503 = DB unreachable) |
| Crons | `https://www.biznest.space/api/health/crons?key=<HEALTH_CHECK_KEY>` | 200 (503 = a cron is failing or overdue; body says which) |
| A live storefront | `https://www.biznest.space/<a-real-store-slug>` | 200, keyword = the store name |

The Crons URL contains a secret: don't share the monitor publicly. A fresh deploy with no cron history reports `pending` and stays 200.

## 4. Backups (20 min)

Supabase's own daily backups are only on paid plans, and are held inside Supabase. These workflows add an independent, encrypted copy and test it.

GitHub repo → Settings → Secrets and variables → Actions → add:

- `BACKUP_DATABASE_URL`: Supabase **session pooler** string, port **5432** (Project Settings → Database → Connection string → Session pooler). Not port 6543, and not the `db.<ref>.supabase.co` host (IPv6 only; GitHub can't reach it).
- `BACKUP_PASSPHRASE`: long random string. **Also save it in your password manager.** Lose it and every backup is unreadable.
- Optional but recommended: `HEALTHCHECK_BACKUP_URL` and `HEALTHCHECK_RESTORE_URL` (two free checks at healthchecks.io, period 1 day / 7 days, grace a few hours). These tell you if backups silently *stop* running, which a failed run can't.
- Optional off-site copy (Cloudflare R2 / Backblaze B2): `BACKUP_S3_BUCKET`, `BACKUP_S3_ENDPOINT`, `AWS_ACCESS_KEY_ID`, `AWS_SECRET_ACCESS_KEY`.
- Optional: `TELEGRAM_BOT_TOKEN`, `TELEGRAM_CHAT_ID` for failure pushes.

Then Actions → **Database backup** → Run workflow, and when it's green → **Backup restore test** → Run workflow. The restore test restores into a throwaway Postgres and checks table count, migration history and row counts against the backup's manifest. After that it runs itself: backups nightly (02:17 UTC), restore test Sundays.

Notes:
- Artifacts are kept 30 days. Use the S3 copy for longer retention.
- It dumps the `public` schema (everything Prisma owns). Not covered: Cloudinary images/KYC documents (back those up with Cloudinary's own backup option), and environment variables (keep a copy of Vercel's env list in your password manager).
- If Supabase moves to a newer Postgres major than 17, bump `postgresql-client-17` and `postgres:17` in both workflows.
- Real data is in these files. Keep the repo private.

### Restoring for real

1. Download the artifact (or S3 object) and `manifest.txt`.
2. `gpg --decrypt -o biznest.dump biznest-<stamp>.dump.gpg` (passphrase prompt).
3. Create a fresh Supabase project (or empty Postgres), then:
   `pg_restore --no-owner --no-privileges --dbname "<NEW_DIRECT_URL>" biznest.dump`
4. Point `DATABASE_URL` / `DIRECT_URL` in Vercel at the new database and redeploy.
5. The build runs `prisma migrate deploy`, which is a no-op when the history is already restored.

Never restore over production without first taking a fresh dump of whatever is there.

## 5. What an alert means

| Alert | Meaning | First move |
|---|---|---|
| `Cron FAILED: subscription-renewals` | Renewal job threw, or every due renewal failed (Paystack down / key changed) | Check status.paystack.com and `PAYSTACK_SECRET_KEY`; Vercel → Logs → filter the route; re-run via `curl -H "Authorization: Bearer $CRON_SECRET" https://www.biznest.space/api/cron/subscription-renewals` (renewal references are deterministic, so a re-run can't double-charge) |
| `Cron FAILED: watchdog` | Another job is failing or never ran; the message names it | Open `/supaadmin/system-health` → Scheduled jobs |
| `PAYMENTS error` / `DATABASE error` | Unexpected failure on the money or DB path | `/supaadmin/system-health`, then Sentry |
| `Paid payments were missed by webhooks` | Gateway took the money but our webhook never recorded it (reconciliation fixed it) | Check the webhook URL/signature in each gateway dashboard |
| `Payments flagged for manual review` | Paid at gateway, couldn't be applied automatically | Review in admin |
| Backup / restore test failed (Telegram or GitHub email) | Backup is not trustworthy | Open the failed run's log; fix; re-run manually |

`/supaadmin/system-health` now also shows a **Scheduled jobs** panel with the last successful run of every cron.
