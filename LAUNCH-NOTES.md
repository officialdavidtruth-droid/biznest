# BizNest pre-launch notes

## Delete these (leftovers that can break `prisma migrate deploy` on a fresh database)
- prisma/migrations/migration_20260922100000_store_marketing_only/   (old wrong folder name; runs LAST and fails with "column already exists")
- prisma/migrations/migration.sql                                    (loose file, Prisma ignores it)

## Set in Vercel before going live
- NEXT_PUBLIC_APP_URL=https://www.biznest.space  (several files fall back to biznest.vercel.app if missing)
- AUTH_URL, AUTH_SECRET, CRON_SECRET, ADMIN_PIN, ADMIN_PIN_SECRET, RESEND_API_KEY, EMAIL_FROM
- LIVE Paystack/Flutterwave keys (not test keys) + FLUTTERWAVE_SECRET_HASH, and webhook URLs set in each dashboard
- SENDBOX_ENV=live (default is sandbox, so deliveries would not be real)
