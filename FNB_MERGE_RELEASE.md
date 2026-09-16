# BizNest FnB — Restaurant Operations Merge

## What changed

BizNest FnB is now the single restaurant/food-business operating application.
The former `restaurant-operations` / Kitchen Operations marketplace plugin has
been removed from the catalog and its functionality has been folded into FnB.

### Unified workspace

- Overview
- POS
- Kitchen Display System
- Orders
- Tables & Reservations
- Menu + kitchen station routing
- Recipes & food cost
- Inventory
- Procurement
- Suppliers
- Customers
- Wastage
- Reports
- FnB Settings

### POS

The existing shared POS remains the transaction engine. FnB now treats it as
the primary Front-of-House workspace and keeps sales linked to the single
`FnbShift` model.

POS sales now snapshot:

- Order type: Dine in / Takeaway / Delivery
- Table/reference label
- Kitchen station per menu item
- FnB fulfillment status
- FnB kitchen status

### Kitchen

Kitchen workflow is separate from the commercial `Order.status` lifecycle:

- `fulfillmentStatus`: NEW → ACCEPTED → PREPARING → READY → FULFILLED
- `kitchenStatus`: QUEUED → STARTED → READY → EXPO → SERVED

`Order.status` is retained for compatibility with the rest of BizNest and is
kept synchronized when FnB advances a ticket.

The KDS includes station filters for Hot Kitchen, Grill, Cold, Drinks, Pizza,
Dessert and Expo and refreshes automatically while the screen is open.

### Staff access

The existing app-level `plugin:fnb-operations` entitlement remains the
subscription gate. Granular FnB permissions are now available for staff:

- `fnb:pos`
- `fnb:orders`
- `fnb:kitchen`
- `fnb:menu`
- `fnb:inventory`
- `fnb:recipes`
- `fnb:procurement`
- `fnb:suppliers`
- `fnb:customers`
- `fnb:reports`
- `fnb:settings`

Existing staff who only have the legacy app-level permission are not silently
locked out. Granular restrictions take effect when one or more `fnb:*`
permissions have been explicitly configured for that staff member.

## Migration

The migration `20260916010000_merge_fnb_kitchen`:

1. Transfers stores installed on `restaurant-operations` to
   `fnb-operations` when they do not already have FnB installed.
2. Removes the old `StorePlugin`, `PluginPlanAccess` and `Plugin` rows.
3. Adds the separate FnB fulfillment and kitchen status fields.
4. Backfills those statuses from the existing `Order.status` values.
5. Adds POS order type/table reference and order-item kitchen station storage.

The old `/admin/kitchen-ops` and `/admin/kitchen` URLs remain only as temporary
redirects to the canonical FnB workspace. They are not separate products.
