# BizNest Travel: file manifest

Unzip over the project root (paths are relative to the project root). Then run `prisma migrate deploy`.

## New files (20)

- `TRAVEL_PLUGIN_IMPLEMENTATION.md`
- `app/store/[slug]/admin/travel/page.tsx`
- `app/store/[slug]/travel/[reference]/page.tsx`
- `components/dashboard/travel-workspace.tsx`
- `components/storefront/travel-enquiry-form.tsx`
- `lib/__tests__/travel.test.ts`
- `lib/actions/__tests__/travel-admin-isolation.test.ts`
- `lib/actions/__tests__/travel-public.test.ts`
- `lib/actions/travel-public.ts`
- `lib/actions/travel.ts`
- `lib/payments/__tests__/settle-travel.test.ts`
- `lib/payments/__tests__/travel-confirmation.test.ts`
- `lib/payments/settle-travel.ts`
- `lib/payments/travel-charge.ts`
- `lib/payments/travel-confirmation.ts`
- `lib/travel-public.ts`
- `lib/travel.ts`
- `prisma/migrations/20261109090000_travel_agency/migration.sql`
- `prisma/migrations/20261110090000_travel_payment_purpose/migration.sql`
- `prisma/migrations/20261110090100_travel_online_payments/migration.sql`

## Modified files (22)

- `app/api/cron/payment-reconciliation/route.ts`
- `app/api/payments/flutterwave/callback/route.ts`
- `app/api/payments/flutterwave/webhook/route.ts`
- `app/api/payments/korapay/callback/route.ts`
- `app/api/payments/korapay/webhook/route.ts`
- `app/api/payments/paystack/callback/route.ts`
- `app/api/payments/paystack/webhook/route.ts`
- `app/store/[slug]/admin/apps/[pluginKey]/page.tsx`
- `app/store/[slug]/admin/apps/page.tsx`
- `components/dashboard/plugin-use-button.tsx`
- `components/storefront/legacy-template-renderer.tsx`
- `components/storefront/reference-homes.tsx`
- `components/storefront/storefront-runtime.tsx`
- `lib/actions/manual-payment.ts`
- `lib/constants/dashboard-nav.ts`
- `lib/page-guides.ts`
- `lib/payments/confirm-destination.ts`
- `lib/payments/manual-flow.ts`
- `lib/payments/payout.ts`
- `lib/payments/pending.ts`
- `lib/plugins.ts`
- `prisma/schema.prisma`

See TRAVEL_PLUGIN_IMPLEMENTATION.md for what each part does and the launch checklist.
