# BizNest FnB Plugin

BizNest FnB is a dedicated full-screen vertical operating workspace for restaurants and food/grocery businesses.

## Architecture
- Canonical route: `/store/[slug]/admin/fnb`.
- The marketplace entry `/store/[slug]/admin/apps/fnb-operations` redirects to the canonical workspace.
- Installed-app navigation points directly to the canonical workspace, matching the dedicated-workspace pattern used by BizNest PMS.
- The admin layout treats `/fnb` as a vertical workspace and does not wrap it in the normal dashboard shell/sidebar. This reduces nested layout/streaming conflicts and keeps the operational UI isolated.
- Staff access is enforced with `plugin:fnb-operations` on the server, so the single FnB permission grants the workspace without requiring separate core Orders/Products permissions.

## Workspace
- Overview / daily operating dashboard
- POS & sales handoff to the hardened BizNest POS register
- Kitchen Display System using live order records and controlled status progression
- Menu management
- Recipes & food-cost configuration stored in product attributes
- Tables & reservations handoff to BizNest bookings
- Inventory, batches and stock rotation
- Procurement and purchase-order visibility
- Supplier directory
- Customer directory
- Wastage recording with an append-only stock movement note
- F&B operational reports
- FnB settings

## Stock rotation
- FIFO (First In, First Out) is supported and is the default.
- FEFO (First Expired, First Out) is also supported and can be selected from FnB Settings.
- The selected policy is persisted in `Store.enabledModules.fnbRotationMode` without adding another database column.
- POS sales, online paid-order stock decrements, and normal inventory negative adjustments use the selected policy for restaurant/food stores.
- Batch consumption remains linked to the existing stock movement ledger.

## Recipe model
Recipes are stored under `Product.attributes.fnbRecipe` so the first release does not require a new schema table. A recipe contains:
- `yieldQty`
- `ingredients[]`
  - `inventoryItemId`
  - `quantity`
  - `unit`
  - ingredient name snapshot

This keeps the feature additive and compatible with the existing flexible product attributes architecture.
