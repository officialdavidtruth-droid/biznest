# Checkout Architecture Update

## What changed

All storefront checkout templates now use `lib/checkout/client.ts` as the single client checkout gateway.

Template files remain presentation-focused and retain their existing designs. The shared gateway forwards requests to the existing authoritative `startCheckout` server action.

## Shared engine responsibilities

The server-side checkout engine remains the source of truth for:

- authenticated customer checks
- store and product availability
- store-scoped product validation
- authoritative database pricing
- delivery-zone validation and fee calculation
- commission and total calculation
- idempotency protection
- order creation
- payment initialization

## Rule for future templates

Do not import `startCheckout` directly from a template. Import `submitCheckout` from `@/lib/checkout/client` instead.
