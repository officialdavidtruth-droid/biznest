# BizNest FnB — FIFO Inventory Upgrade

This upgrade adds auditable first-in-first-out inventory lots for food and other stock-managed businesses.

## Included
- `InventoryBatch` lots with quantity received/remaining, unit cost, received date, optional lot number and expiry date.
- `InventoryBatchConsumption` immutable allocation ledger linking each negative stock movement to the exact batches consumed.
- Existing positive inventory is migrated into an `OPENING-BALANCE` lot so FIFO starts from a known opening quantity instead of inventing historical receipts.
- Restocks, purchase-order receipts, returns, and manual positive adjustments create new FIFO lots.
- Online orders and POS sales consume the oldest remaining lot first.
- Negative inventory corrections consume FIFO lots too.
- Purchase-order receiving accepts optional batch/lot and expiry details.
- FnB workspace shows active FIFO batches, FIFO stock value, expiring-in-7-days count, expired-batch count, and the oldest available lots.
- Existing stock movement ledger remains the quantity audit trail; batch consumption adds cost/lot traceability.

## FIFO behavior
1. Oldest `receivedAt` lot is consumed first.
2. Ties are deterministic by batch id.
3. A sale can consume multiple lots when one lot is insufficient.
4. Stock cannot go negative; a failed FIFO allocation rolls back the transaction.
5. Expiry is surfaced as an operational warning but is not silently skipped, because this implementation is FIFO rather than FEFO.

## Migration
Apply `prisma/migrations/20260910040000_fifo_inventory/migration.sql` after the existing requisition migration.

## Important
The repository did not contain installed `node_modules` in the build workspace, so Prisma validation and the full TypeScript/Next build could not be executed here. Run your normal `prisma generate`, migration deploy, lint, tests, and production build in CI/Vercel before release.
