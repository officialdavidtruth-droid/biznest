# BizNest payment/subaccount production fix

This build is based on the original BizNest signature-template ZIP. The following payment files were updated in-place:

- `lib/payments/paystack.ts`
- `lib/payments/flutterwave.ts`
- `lib/actions/store.ts`
- `lib/actions/order.ts`
- `lib/actions/quote.ts`
- `lib/actions/invoice.ts`
- `components/dashboard/connect-payout-form.tsx`

## What changed

- Paystack subaccount creation now sends the documented contact fields (`primary_contact_name`, `primary_contact_email`, `primary_contact_phone`) and records the provider's returned `is_verified` state. urlrefhttps://paystack.com/docs/api/subaccount/
- A newly connected Paystack account never inherits an old `payoutVerifiedAt` value. BizNest only marks it verified after Paystack reports `is_verified: true`.
- Disconnecting a payout account clears its connection/verification timestamps so stale state cannot unlock checkout.
- Flutterwave subaccount creation now supplies the documented Nigerian contact fields including business mobile, business contact, business contact mobile, country, and percentage split.
- Flutterwave's percentage split remains the platform commission percentage, expressed as a decimal, matching Flutterwave's split-payment documentation.
- Paystack marketplace checkout is blocked until the provider confirms the subaccount. This prevents a new customer payment from being accepted while BizNest knows the Paystack payout target is still unverified.
- Flutterwave is not falsely marked KYC-verified: its v3 collection-subaccount API does not expose Paystack's `is_verified` field. BizNest treats successful subaccount creation as a connection and leaves any compliance/settlement decision to Flutterwave.
- Quote and invoice deposit/payment actions are also protected by payout readiness.

## Important provider limitation

Submitting government ID inside BizNest does not itself approve a Paystack or Flutterwave merchant account. The payment provider remains responsible for its own compliance review and settlement controls.

For Paystack, the API exposes `is_verified`; BizNest checks that status rather than assuming that the merchant's BizNest KYC submission is equivalent to Paystack verification.
