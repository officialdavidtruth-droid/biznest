# BizNest Inline Card Payments

Storefront order checkout now supports an in-page card-payment experience for the active gateway.

## Supported gateways

- Paystack InlineJS: the server initializes the transaction and the browser resumes it with the returned access code. The customer stays on the BizNest checkout until the provider finishes authentication.
- Flutterwave Inline: the browser opens Flutterwave's inline checkout with the store's existing Flutterwave subaccount split. The server does not handle raw card data.

## Environment variables

Set the provider public keys in Vercel/environment configuration:

- `NEXT_PUBLIC_PAYSTACK_PUBLIC_KEY`
- `NEXT_PUBLIC_FLUTTERWAVE_PUBLIC_KEY`

The existing server-side secrets remain required:

- `PAYSTACK_SECRET_KEY`
- `FLUTTERWAVE_SECRET_KEY`

The existing per-store payout/subaccount connection remains the settlement target. BizNest never stores card number, CVV, PIN, or other raw card credentials.

## Fallback

If a public key is not configured, checkout falls back to the existing provider authorization URL rather than breaking payment completely.

## Verification

The existing Paystack and Flutterwave callback/webhook verification paths remain authoritative. A successful browser callback is not trusted by itself; the server verifies the transaction with the provider and checks the order amount before marking the order paid.
