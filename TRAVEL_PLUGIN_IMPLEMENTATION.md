# BizNest Travel (app key: `travel-agency`)

Operating workspace for travel agencies at `/store/[slug]/admin/travel`. Eligible business type: **Travel & Tourism**.
Plans: Growth Store and Business Mogul. Price is left at 0 and set by the super admin in /supaadmin/apps, like every other paid app.

## What it does
- **Clients**: passport number/expiry, nationality, contacts. Passport-validity warnings (under 6 months at travel date).
- **Trips**: file per booking with reference `TRV-YYMM-XXXX`. Pipeline ENQUIRY > QUOTED > CONFIRMED > TICKETED > TRAVELLING > COMPLETED (or CANCELLED).
  Guards: needs a price to confirm, a deposit before ticketing, zero balance before completing; closed trips are immutable.
- **Service lines**: flight/hotel/transfer/tour/visa/insurance with supplier, confirmation ref, cost and sell price. Trip price and cost recalculate from non-cancelled lines.
- **Payments**: deposits, instalment schedule with due dates, mark-paid, void; balance and overdue alerts. Overpayment is rejected.
- **Packages**: group tours with fixed price, departure date and seat limit; booking a package checks remaining seats.
- **Visas**: case per client with default document checklist and status flow.
- **Suppliers**: directory with archive.
- **Overview**: pipeline, upcoming departures, outstanding balances, revenue, margin, overdue instalments, passport alerts.

## Files
- `prisma/schema.prisma` + `prisma/migrations/20261109090000_travel_agency` (additive: 8 new tables, no changes to existing tables)
- `lib/travel.ts` (constants and pure helpers), `lib/actions/travel.ts` (store-scoped, permission + entitlement checked server actions)
- `components/dashboard/travel-workspace.tsx`, `app/store/[slug]/admin/travel/page.tsx`
- Wiring: `lib/plugins.ts`, `components/dashboard/plugin-use-button.tsx`, `app/store/[slug]/admin/apps/[pluginKey]/page.tsx`, `app/store/[slug]/admin/apps/page.tsx`, `lib/constants/dashboard-nav.ts`, `lib/page-guides.ts`
- Tests: `lib/__tests__/travel.test.ts`

## Security model
Every action calls `assertStorePermission(slug, "plugin:travel-agency")`, then checks plugin entitlement, installation and business type. Every query is filtered by `storeId`; child rows (travellers, items, payments) are only reached through a trip that belongs to the store.

## Verified here / still to do on your side
Verified: Prisma schema validates, client generates, `tsc` reports no errors in the new or edited files (50 existing errors are all in unrelated `*.test.ts` files), new unit tests pass.
Not verified (no database or network in this sandbox): `prisma migrate deploy`, and a click-through in the browser. Run `npm run build`, then install the app from Apps on a Travel & Tourism store and test with two stores to confirm isolation.
