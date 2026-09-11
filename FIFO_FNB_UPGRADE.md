# BizNest FnB — FIFO + FEFO Inventory Upgrade

BizNest FnB supports both auditable FIFO and FEFO stock rotation.

## FIFO
- Oldest `receivedAt` batch is consumed first.
- Ties are deterministic by batch id.
- A sale can consume multiple batches when one batch is insufficient.
- Opening balances are represented as deterministic opening lots.

## FEFO
- Nearest usable expiry is consumed first.
- Expired lots are not silently sold.
- Lots without an expiry date remain fallback stock.

## Selection
FnB Settings exposes a store-level rotation policy:
- FIFO — First In, First Out (default)
- FEFO — First Expired, First Out

The selection is stored in `Store.enabledModules.fnbRotationMode` and is applied by POS sales, online paid-order stock decrements and inventory negative adjustments for FnB businesses.

## Auditability
- `InventoryBatch` stores receipt/expiry/cost information.
- `InventoryBatchConsumption` records exactly which lots were consumed.
- `StockMovement` remains the quantity audit trail.

## Important
The uploaded repository did not contain a complete install of `node_modules`, so a full production TypeScript/Next build could not be completed in this environment. Run `npm ci`, `prisma generate`, migration deployment, lint/tests and `npm run build` in CI/Vercel before release.
