# BizNest Priority 2 + 4 Implementation

Implemented directly on top of the existing BizNest Phase 1 source without replacing existing POS/order/inventory flows.

## Priority 2 — Unified POS + Online Sales

- Existing POS remains the source of truth for in-person transactions.
- POS sales continue to use the existing `Order`, `OrderItem`, `Payment`, `StockMovement`, and commission ledger.
- Added persistent store-scoped customer profiles for named POS customers.
- Added customer search to the POS register by name, phone, or email.
- A selected customer profile is attached to the POS order.
- New POS customer details are automatically created/updated in the store's customer profile.
- Inventory remains shared: POS stock decrements use the same inventory/variant records as online storefront sales.
- POS captures optional email in addition to name/phone.
- Customer profile creation can link to an existing BizNest `User` when the supplied email matches.

## Priority 4 — Customer 360

- Added a store-scoped `StoreCustomerProfile` model.
- Added `Order.customerProfileId` so offline sales have a durable CRM identity.
- Added a server-side `getCustomer360()` action protected by the existing `customers` staff permission.
- Customer 360 merges online orders and POS orders using profile, email, phone, and buyer identity.
- Shows lifetime value, order count, average order value, last/first purchase, online vs POS purchases, recent orders, and top products.
- Customers without purchases but with a POS/CRM profile remain visible.
- Added direct call, WhatsApp, and email actions where contact details exist.

## Database migration

`prisma/migrations/20260822130000_customer_360/migration.sql`

Run the normal deployment migration command against the configured Supabase/PostgreSQL database before using the new features.

## Important verification

The source changes were made against the uploaded Phase 1 codebase. The execution environment did not complete `npm ci`/Prisma generation within the available build window, so a full `next build` could not be completed here. The production deployment should run `prisma generate`, apply the migration, then run the normal Next.js build as already defined in `package.json`.
