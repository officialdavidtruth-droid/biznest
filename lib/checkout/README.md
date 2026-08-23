# BizNest Checkout Architecture

Checkout is split into two layers:

- **Presentation layer**: each storefront template keeps its own checkout UI and branding.
- **Shared checkout engine**: all templates call the same client gateway and the same authoritative server action.

`client.ts` is the single client handoff. `lib/actions/order.ts:startCheckout` remains the authoritative engine and is responsible for server-side validation, product lookup, delivery pricing, totals, idempotency, order creation and payment initialization.

New templates must not call `startCheckout` directly. They should use `submitCheckout`.
