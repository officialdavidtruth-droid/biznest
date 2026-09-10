# Testing

Two kinds of tests live side by side here, and it matters which is which:

- **Pure unit tests** (`lib/utils/__tests__`, `lib/__tests__/rate-limit.test.ts`)
  — no database, either testing a pure function or mocking Prisma entirely.
  These run anywhere, instantly, no setup required.
- **DB integration tests** (`lib/actions/__tests__`) — these call the real
  server actions (`createPosSale`, `startCheckout`, `issueRefund`, ...)
  against a **real Postgres database** through the real Prisma client.
  Only `auth()`, `next/cache`'s `revalidatePath`, webhook delivery, and
  activity logging are mocked (see `vitest.setup.ts`) — everything else,
  including the actual `$transaction` calls this app's money/stock logic
  depends on, runs for real. A mocked Prisma client can't catch a bug in a
  transaction; only a real database can.

## Running the DB integration tests

You need a disposable Postgres database — **never point this at
production or at your local dev database**, since the fixtures create and
delete real rows (and `cleanupTestStore` deletes by id, not by wiping
tables, but a bug in a test's cleanup could still leave rows behind).

```bash
# Spin up a throwaway Postgres, e.g.:
docker run -d --name biznest-test-db -p 5433:5432 \
  -e POSTGRES_PASSWORD=test -e POSTGRES_DB=biznest_test postgres:16

# Point Prisma at it and push the schema (no migration history needed
# for a scratch test DB):
export DATABASE_URL="postgresql://postgres:test@localhost:5433/biznest_test"
npx prisma db push

# Run the suite
npm run test          # single run
npm run test:watch    # watch mode
```

If `DATABASE_URL` isn't set, the integration tests will fail immediately
on their first `prisma.*.create()` call rather than silently touching
whatever database Prisma falls back to — there's no fallback configured,
so double-check your `.env`/`.env.test` before running.

## Fixtures

`lib/actions/__tests__/fixtures.ts` provides:

- `createTestStoreWithOwner(opts?)` — a User (owner) + Business + Store,
  optionally with a Subscription set to a specific `commissionRate`.
- `createTestProduct(storeId, opts?)` — a product with an InventoryItem
  (unless `hasVariants: true`, in which case add variants yourself via...
- `createTestVariant(productId, storeId, opts?)`
- `cleanupTestStore(fixture)` — deletes everything created for one store,
  in FK-safe order, plus the store's POS walk-in customer User row. Call
  this in `afterEach`, always — these tests share one database, and a
  fixture left behind (a Store, a walk-in User with a fixed email) can
  collide with or pollute a later run.

Every fixture is tagged with a random suffix (`nanoid`) so parallel test
files, and repeated local runs, never collide on unique columns
(`Store.slug`, `User.email`, etc).

## Writing a new integration test

1. `beforeEach`: create a fixture store (and any products/variants you
   need), call `setSession(...)` as whichever user should be "logged in".
2. Call the real action.
3. Assert against real rows read back from `prisma`.
4. `afterEach`: `clearSession()` and `cleanupTestStore(fixture)`.

When a test deliberately exercises a race (see `pos.test.ts`'s concurrent-
oversell test), fire both calls with `Promise.all` rather than sequential
`await`s — sequential calls can't actually race inside one transaction-
supporting database, so the test would pass even with the bug it's meant
to catch.
