# BizNest Template Reset

The legacy storefront template collection has been retired.

## Active template

- **Grandeur — Fine Dining Restaurant**
- Source: `components/storefront/grandeur-restaurant.tsx`
- Preview route: `/template-preview/Grandeur%20%E2%80%94%20Fine%20Dining%20Restaurant`

## Architecture rule

Each future template must own its presentation and customer-facing flow. Shared platform infrastructure may be reused for authentication, store-scoped customer accounts, cart storage, orders and payment processing, but one template must never import another template's UI or business presentation.

The next template is not added until its full visual design is approved first.
