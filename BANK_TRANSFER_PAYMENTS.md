# Bank transfer is the default way customers pay a store

Unless the store owner has switched on their OWN Paystack/Flutterwave keys (see OWN_GATEWAY_KEYS.md),
every customer-to-vendor payment is a direct bank transfer:

1. Customer is sent to a pay page showing the vendor's account, WhatsApp and call line.
2. Customer uploads a screenshot of the transfer.
3. Vendor confirms receipt; the normal settlement then runs (order paid, invoice paid, booking paid, ...).

| Purpose | Pay page | Proof stored on | Vendor confirms in |
|---|---|---|---|
| Order | `/store/[slug]/orders/[id]/pay` | `Order.paymentProofUrl` | the order page |
| Invoice, quote deposit, service booking, PMS deposit | `/store/[slug]/pay/[reference]` | `Payment.proofUrl` | Admin > Payments > "Transfers waiting for you" |

Routing lives in `lib/payments/manual-flow.ts` (`resolvePayRoute`: own keys -> gateway, else bank transfer,
else "store hasn't set up payments"). Bank-transfer Payment rows are provider `CASH`, so no BizNest payout is ever queued.
Never platform-gateway: subscriptions, app purchases and customer wallet top-ups are unchanged.

Deploy: run migration `20261107090000_payment_transfer_proof` (`prisma migrate deploy`).
