# BizNest Travel: files built in this chat

Copy each file to the same path inside your project (biznest-main/). Paths are relative to the project root.

## New files
- lib/travel-documents.ts (PDF quote / invoice / itinerary builder)
- app/api/store/[slug]/travel/[tripId]/document/route.ts (PDF download route)
- lib/payments/refund-travel.ts (full and partial refunds, payout effect)
- prisma/migrations/20261116090000_travel_payment_refunds/migration.sql (run: prisma migrate deploy)
- lib/__tests__/travel-documents.test.ts
- lib/__tests__/travel-refund.test.ts
- lib/payments/__tests__/refund-travel.test.ts

## Changed files
- lib/travel.ts
- lib/actions/travel.ts
- lib/actions/refund.ts
- lib/payments/travel-confirmation.ts
- components/dashboard/travel-workspace.tsx
- prisma/schema.prisma
- lib/__tests__/travel.test.ts
- lib/actions/__tests__/travel-admin-isolation.test.ts
- TRAVEL_PLUGIN_IMPLEMENTATION.md
