# Template fixes patch

Copy the contents of this folder over your project root (paths are relative to the repo root).

## Delete these 26 files
- DELETED_TEMPLATES.txt
- IMPLEMENTATION_NOTES_SIGNATURE_TEMPLATES.md
- SIGNATURE_TEMPLATE_REBUILD.md
- TEMPLATE_PRODUCTION_AUDIT.md
- TEMPLATE_RESET.md
- app/SIGNATURE_CUSTOMER_EXPERIENCE-1.css
- components/marketing/marketing-templates-section.tsx
- components/storefront/hotel-catalog.tsx
- components/storefront/live-template-preview.tsx
- components/storefront/storefront-page.tsx
- components/storefront/template-preview-page.tsx
- components/storefront/template-style-preview.tsx
- components/storefront/templates/arcova-home.tsx
- components/storefront/templates/fabtex-home.tsx
- components/storefront/templates/homevista-home.tsx
- components/storefront/templates/juicelife-home.tsx
- components/storefront/templates/marketplace-home.tsx
- components/storefront/templates/nova-home.tsx
- components/storefront/templates/premium-home.tsx
- components/storefront/templates/rivora-home.tsx
- components/storefront/templates/rrw-home.tsx
- components/storefront/templates/violet-home.tsx
- lib/actions/fixtures.ts
- lib/actions/order.test.ts
- lib/actions/pos.test.ts
- lib/actions/refund.test.ts

## Added (10)
- app/store/[slug]/experiences/page.tsx
- app/store/[slug]/facilities/page.tsx
- docs/TEMPLATES.md
- lib/__tests__/template-consistency.test.ts
- lib/default-images.ts
- lib/storefront/resolve-renderer.ts
- lib/utils/__tests__/format-money.test.ts
- lib/utils/format-money.ts
- lib/utils/store-href.ts
- scripts/fetch-default-images.mjs

## Replaced (30)
- .env.example
- app/store/[slug]/account/bookings/[bookingId]/page.tsx
- app/store/[slug]/account/bookings/page.tsx
- app/store/[slug]/account/wishlist/page.tsx
- app/store/[slug]/admin/templates/page.tsx
- app/template-preview/[name]/page.tsx
- components/dashboard/template-gallery.tsx
- components/storefront/builder-renderer.tsx
- components/storefront/catalog-item-detail.tsx
- components/storefront/example-store.tsx
- components/storefront/grandeur-restaurant.tsx
- components/storefront/hotel-room-detail.tsx
- components/storefront/legacy-template-renderer.tsx
- components/storefront/photography-booking-client.tsx
- components/storefront/signature-screenshot-home.tsx
- components/storefront/storefront-runtime.tsx
- components/storefront/tastehouse.tsx
- components/storefront/templates/heenzy-home.tsx
- components/storefront/theluso-hotel.tsx
- components/storefront/veloura-account-profile.tsx
- components/storefront/veloura-support-page.tsx
- lib/actions/__tests__/pos.test.ts
- lib/builder-config.ts
- lib/hotel-content.ts
- lib/storefront/signature-renderers.ts
- lib/template-builder-config.ts
- lib/template-compatibility.ts
- lib/template-registry.ts
- lib/template-themes.ts
- prisma/seed.ts

## After copying
1. Delete the files listed above.
2. `npm run build`
3. `npx prisma db seed` (adds Example template, corrects categories)
4. Optional: `node scripts/fetch-default-images.mjs` then set `NEXT_PUBLIC_DEFAULT_IMAGE_BASE_URL=/defaults`
