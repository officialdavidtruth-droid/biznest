# BizNest Production Repair Notes

This build is a source-level consolidation pass focused on removing customer-visible prototype behavior and closing high-risk commerce/payment gaps.

## Fixed

- Product variants now travel from storefront selection → local cart → checkout validation → OrderItem.variantId → server-authoritative variant price/stock.
- Cart operations are variant-aware, so two variants of the same product no longer collide.
- Checkout ignores client-submitted prices and validates product/variant ownership, publication state, and available quantity server-side.
- Physical inventory is preflight-checked before creating an online order.
- Paystack and Flutterwave callbacks/webhooks now require the order's configured provider and verify the exact order amount rather than accepting overpayment.
- Restaurant and specialty storefronts no longer display payment methods, taxes, service charges, discounts, shipping fees, or schedules that the backend does not actually implement.
- Restaurant checkout quantity/remove controls now update the real cart.
- Generic/retired storefront templates fall back to the universal BizNest builder instead of exposing an internal “rebuild in progress” page.
- Demo/fabricated storefront claims were removed from the most prominent customer journeys (fake customer counts, fake discount totals, fake payment details, fake tracking/order data, fake partner brands, and fake coupons).
- Quote public links now use a signed HMAC token; accepting/declining a quote is additionally restricted to the assigned customer/email.
- Quote links sent by email/WhatsApp now carry the signed token.
- Builder copy no longer exposes internal “customize this benefit” instructions to customers.
- Added a `typecheck` package script.

## Verification performed in this environment

- Parsed all 621 TypeScript/TSX source files with the TypeScript parser: **0 syntax errors**.
- `package.json` and `tsconfig.json` parse successfully.
- Full Next.js/Vitest/ESLint execution was not possible from the supplied archive because the archive does not contain an installed dependency tree (`node_modules`). A clean `npm ci` should be run before final deployment.

## Required release verification

Run after installing dependencies and providing a staging `DATABASE_URL`:

```bash
npm ci
npm run typecheck
npm run lint
npm test
npm run build
npx prisma migrate status
```

Then perform a staging end-to-end pass for:

1. variant product purchase with two different option combinations
2. insufficient stock and simultaneous payment attempts
3. Paystack success/failure/replay
4. Flutterwave success/failure/replay
5. restaurant delivery/takeaway totals
6. hotel/service booking overlap
7. quote public-link access and customer authorization
8. two stores with two separate customer accounts (tenant isolation)
9. mobile storefront + mobile merchant dashboard
10. clean database migration on a disposable staging database
