# BizNest product audit fixes: file list

Unzip over the project root; every path below is relative to it.

## New files
- lib/digital-files.ts: private digital file helpers + signed direct upload (steps 3, 8)
- app/api/upload/sign/route.ts: mints Cloudinary upload signatures for large digital files (step 8)
- app/store/[slug]/orders/[orderId]/download/[itemId]/route.ts: gated download route (step 3)
- lib/catalog-identifiers.ts: SKU/barcode check across products and variants (step 4)
- lib/variant-combos.ts: pure variant sync logic (step 7)
- prisma/migrations/20261030120000_webhook_product_deleted/migration.sql: adds PRODUCT_DELETED (step 7)
- lib/__tests__/product-validation.test.ts
- lib/__tests__/variant-combos.test.ts
- lib/__tests__/catalog-identifiers.test.ts
- lib/__tests__/product-delete.test.ts

## Changed files
- lib/actions/variant.ts (steps 1, 4, 5, 7)
- lib/actions/product.ts (steps 2, 4, 6, 7)
- lib/validations/product.ts (steps 6, 8)
- lib/validations/variant.ts (step 5)
- lib/entitlements/index.ts (step 4)
- lib/webhooks/events.ts (step 7)
- prisma/schema.prisma (step 7, one added enum value)
- app/api/upload/route.ts (step 3)
- app/store/[slug]/orders/[orderId]/confirmation/page.tsx (step 3)
- app/store/[slug]/admin/products/page.tsx (step 6)
- components/forms/product-form.tsx (steps 3, 8)
- components/dashboard/delete-product-button.tsx (step 2)
- components/dashboard/product-row-actions.tsx (step 2)

## After copying
1. npx prisma migrate deploy
2. npx prisma generate
3. npx vitest run
