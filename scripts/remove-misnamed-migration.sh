#!/usr/bin/env sh
# Run from the project root. Removes the misnamed duplicate migration folder.
# Safe: 20260922100000_store_marketing_only (correct name) already adds the
# column idempotently, and `prisma migrate deploy` ignores applied migrations
# that no longer exist locally.
set -e
rm -rf prisma/migrations/migration_20260922100000_store_marketing_only
echo "Removed prisma/migrations/migration_20260922100000_store_marketing_only"
ls prisma/migrations | grep -c "store_marketing_only" | sed 's/^/Remaining store_marketing_only migrations (expect 1): /'
