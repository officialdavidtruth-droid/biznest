# Biznest Template Production Audit

This pass hardens the existing template system without creating duplicate templates.

## Changes
- Removed/softened hard-coded merchant performance claims in screenshot-derived templates.
- Removed third-party delivery-platform brand claims from merchant storefront copy.
- Replaced fake restaurant discount codes and fabricated default prices with store-safe copy.
- Restaurant reservation CTAs now use a booking-aware destination when the store has bookable services, otherwise contact.
- Fixed the professional-service restaurant reservation navigation that incorrectly pointed to `/services`.
- `getTemplateTheme()` now resolves a meaningful theme by business category instead of always returning Fresh & Co.
- Added `lib/template-quality.ts` with canonical storefront route validation and demo-claim guardrails.

## Remaining runtime QA
The templates should still be tested against real stores for mobile layout, empty catalogs, missing images, booking availability, checkout, custom pages, SEO metadata, and accessibility. Static source review cannot replace browser testing.
