# BizNest Deep Repair Pass

This archive contains a deep repair pass focused on the architectural and production-risk issues identified in the code review.

## What was repaired

### Storefront architecture
- Added a canonical business identity/normalization layer.
- Added a single template registry and storefront renderer resolver.
- Consolidated `/store/[slug]` homepage routing onto one storefront runtime.
- Removed duplicated storefront routing from the live homepage path.
- Replaced live hard-coded `THELUSO`/legacy template checks in storefront routes with registry-based resolution.
- Unified template compatibility around the registry and canonical business types.

### Merchant-safe content
- New hotel stores no longer fall back to branded demo hotel claims as live business content.
- Hotel room rendering uses published services as the room source.
- Removed hard-coded business contact fallbacks from live hotel rendering.
- Removed fake trust/credibility claims from generic/universal storefront sections.
- Removed the hard-coded dashboard Pro-plan/76% usage display.
- Removed several hard-coded demo review/trust/discount signals from live template renderers.
- Hotel add-ons are no longer invented with static prices; the page shows an empty state until the business configures real extras.

### Tenant access
- Added missing store permission checks to multiple niche/admin pages.
- Kept server-side permission enforcement separate from navigation visibility.
- Tightened payment reference reuse so a reference belonging to another store cannot be silently reused.

### Payments
- Added a reusable durable pending-payment helper.
- Payment attempts are persisted before external gateway initialization in orders, invoices, quotes, subscriptions, plugin purchases, and PMS reservations.
- Gateway failures mark the local payment attempt failed.
- Order payment initialization reuses an existing pending checkout instead of creating duplicate charges.
- Successful gateway initialization updates the pre-existing payment record with the provider/split information.

### Business capabilities
- Added canonical business-type normalization to capability and navigation decisions.
- Reduced direct string comparisons for restaurant/hotel classification.
- Store creation now persists a canonical timezone and mirrors the business category into the store's legacy `businessType` field.

### Booking/date handling
- Added store-timezone helpers.
- Booking availability uses the store timezone for day boundaries, weekdays, current-day rules, slot calculations, and local scheduled times.
- Default store timezone is `Africa/Lagos`.

### Database
- Added `Store.timezone` with a migration and backfill of the legacy store business-type mirror from Business.category.

## Validation

- TypeScript/TSX parser validation: **48 changed TypeScript files, 0 parse errors**.
- A full `tsc --noEmit` could not be treated as a valid project validation because the supplied archive did not have a complete installed dependency environment; the compiler reported widespread missing React/Next/Node/dependency types. A clean dependency install (`npm ci`) also timed out in the inspection environment.
- The full Vitest suite and production build therefore have **not** been falsely marked as passing.
- The repository's two-account/two-store authorization penetration test still needs to be run against a real PostgreSQL test database before production release.
