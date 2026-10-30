# Korapay gateway

Korapay is a third platform gateway next to Paystack and Flutterwave. **SupaAdmin stays in control**:
`/supaadmin/settings` -> Payments -> "Active payment gateway" now lists Paystack, Flutterwave and Korapay.
"Make active" is only enabled once that gateway's secret key is in the environment, and every switch is audit-logged
(`PAYMENT_GATEWAY_CHANGED`). Nothing else in the code decides which gateway store checkout uses.

## What follows the SupaAdmin switch
- Store checkout: orders, invoices, quote deposits, service bookings, PMS reservations, customer wallet top-ups.
- Refunds: always go back through the gateway that took the original charge (not the active one).
- Vendor payouts: a Korapay collection is paid out to the vendor's bank from the Kora balance (no commission, no split).
  Wallet payments pick the active gateway once, when the payout is queued.

## Deliberately unchanged
- Nothing is pinned to Paystack any more: plan payments and app purchases/renewals are pinned to Korapay
  (`gateway: "KORAPAY"` in `lib/actions/subscription.ts` and `lib/actions/plugins.ts`). Apps use `app/api/payments/korapay/plugin-callback`;
  an app lapses into a 5-day grace period, then is suspended until renewed from the Apps page ("Renew" shows in its last 7 days).

## BizNest plan (subscription) payments are on Korapay
- `lib/actions/subscription.ts` charges plan payments through Korapay (`gateway: "KORAPAY"`), settled by
  `app/api/payments/korapay/subscription-callback`, the Korapay webhook and the reconciliation cron
  (all via `lib/payments/settle-subscription.ts`).
- Kora hosted checkout has no saved card, so plans are renewed by the owner: they get a reminder 3 days before expiry,
  a "Renew plan" button appears on the subscription page in the last 7 days, and a plan that lapses gets the usual
  5-day grace period before the dashboard is paused. Stores that still hold an old Paystack saved card keep
  auto-renewing until their next plan payment, which clears it.
- Store-owned gateway keys (`/store/[slug]/admin/payments`) are still Paystack/Flutterwave only.

## Environment variables
| Variable | Required | Notes |
|---|---|---|
| `KORAPAY_SECRET_KEY` | yes | Dashboard -> Settings -> API Configuration. Test keys = sandbox, live keys = live. Also signs webhooks. |
| `KORAPAY_PAYOUT_EMAIL` | no | Customer email Kora requires on payouts. Defaults to `payouts@biznest.space`. |
| `PAYOUT_PROXY_URL` | live payouts | HTTP forward proxy with a static IP. Payout/balance calls (Kora and Flutterwave) go through it; whitelist its IP in the Kora dashboard. |
| `KORAPAY_BASE_URL` | no | Only if Kora tells you to use a different host. Default `https://api.korapay.com/merchant/api/v1`. |

## Kora dashboard setup
1. Webhook URL (collections and payouts): `https://biznest.space/api/payments/korapay/webhook`
   (there is no separate secret hash: Kora signs the `data` object with your secret key, header `x-korapay-signature`).
2. Whitelist your server IPs for payouts (Kora only accepts the Payout API from whitelisted IPs in live mode).
   Vercel has no fixed outbound IP: run a small forward proxy on a static-IP VPS and set `PAYOUT_PROXY_URL`,
   then whitelist that IP. Without it payouts stay QUEUED with a "whitelist" error and retry automatically.
3. Keep enough NGN balance: payouts are sent from it, and wait/retry when it is short.

## Database
Migration `20261024120000_korapay_gateway` adds `KORAPAY` to the `PaymentProvider` enum (part of `npm run build`).

## Files
- New: `lib/payments/korapay.ts`, `app/api/payments/korapay/callback/route.ts`, `app/api/payments/korapay/webhook/route.ts`,
  `lib/payments/__tests__/korapay.test.ts`, `prisma/migrations/20261024120000_korapay_gateway/`
- Changed: `prisma/schema.prisma`, `lib/payments/{gateway,payout,payout-gateway,bank-codes,payout-target,settle-*}.ts`,
  `lib/actions/{site-settings,store,refund,customer-wallet}.ts`, `components/dashboard/{settings-forms,connect-payout-form}.tsx`,
  `app/supaadmin/settings/page.tsx`, `app/supaadmin/payouts/page.tsx`

## Known limits
- Checkout is Kora's hosted redirect page (no in-page card modal like Paystack/Flutterwave inline).
- Bank-transfer under/overpayments are not auto-settled: the amount check flags them for review, same as the other gateways.
- Test in sandbox before going live (see the checklist in the hand-off message).
