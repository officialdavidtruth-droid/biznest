# Store-owned payment gateway keys

Store owners can add their own Paystack and/or Flutterwave keys at
`/store/[slug]/admin/payments` ("Your own payment gateway"). Owner only (staff cannot see or change keys).

## Behaviour
- While switched on, customer payments for that store (orders, invoices, quote deposits, service bookings,
  PMS reservations) are charged with the store's keys. Money lands in the store's own gateway account.
- Those payments are flagged `Payment.usesStoreGateway`. Verification, webhooks and refunds use the store's key;
  no BizNest `Payout` is created (`queuePayoutForPayment` skips them); payout-account gates are skipped.
- Always platform-owned (never use store keys): subscription billing, app purchases, customer wallet top-ups.
- If the owner turned it on but the keys can't be decrypted, checkout errors instead of silently falling back to the platform account.

## Security
- Secret keys and the Flutterwave webhook hash are AES-256-GCM encrypted (`lib/payments/store-gateway.ts`).
  Key: `STORE_GATEWAY_ENCRYPTION_KEY` (falls back to `AUTH_SECRET`). Do not change it once stores have saved keys.
- Keys are checked against the gateway before saving. Public keys are optional (without one, checkout uses the hosted page instead of inline card).

## Webhooks (recommended per store)
- Paystack: `https://<domain>/api/payments/paystack/webhook?store=<storeId>`
- Flutterwave: `https://<domain>/api/payments/flutterwave/webhook?store=<storeId>` (secret hash shown in the dashboard)
- Store webhooks can only settle that store's own `usesStoreGateway` payments. The platform webhook ignores them.
- Without a webhook, the browser callback still verifies and settles payments.

## Deploy
Run the migration `20261023130000_store_own_gateway_keys` (`prisma migrate deploy`, already part of `npm run build`).
