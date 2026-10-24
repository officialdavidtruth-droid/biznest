# Payment webhooks: audit result + reconciliation job

## Audit (Paystack, Flutterwave, Korapay)
- Signatures: all three verify with constant-time comparison (Paystack HMAC-SHA512 of raw body, Flutterwave `verif-hash`, Korapay HMAC-SHA256 of `data`). OK.
- Never trusting the payload: every charge is re-verified against the gateway API before settling. OK.
- Idempotency: every settle* function claims the Payment row with `updateMany where status = PENDING`, so duplicate deliveries do nothing. OK.
- Fixed: Flutterwave webhook answered 200 when Flutterwave's verify API was unreachable, dropping the confirmation. It now answers 502 (so Flutterwave retries) for payments we know about.
- Known, not changed: the Flutterwave `SUBUP-` branch updates the store's plan before claiming the Payment row (replay-safe in practice, but Paystack's branch claims first). Worth aligning later.

## New: /api/cron/payment-reconciliation
Every PENDING payment 10 min – 3 days old is checked directly with its gateway; if paid, the same settle function the webhook uses is run. Failed charges older than 24h are marked FAILED. Paid subscription upgrades are flagged for manual review instead of half-applied. Payments with a stored `reviewReason` are skipped.

Schedule is daily (vercel.json) because the existing crons assume Vercel Hobby. On Vercel Pro change to e.g. `*/15 * * * *`.
Needs CRON_SECRET (already used by the other crons). Test: `curl -H "Authorization: Bearer $CRON_SECRET" https://www.biznest.space/api/cron/payment-reconciliation`
