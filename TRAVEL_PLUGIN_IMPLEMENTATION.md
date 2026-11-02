# BizNest Travel (app key: `travel-agency`)

Operating workspace for travel agencies at `/store/[slug]/admin/travel`. Eligible business type: **Travel & Tourism**.
Plans: Growth Store and Business Mogul. Price is left at 0 and set by the super admin in /supaadmin/apps, like every other paid app.

## What it does
- **Clients**: passport number/expiry, nationality, contacts. Passport-validity warnings (under 6 months at travel date).
- **Trips**: file per booking with reference `TRV-YYMM-XXXX`. Pipeline ENQUIRY > QUOTED > CONFIRMED > TICKETED > TRAVELLING > COMPLETED (or CANCELLED).
  Guards: needs a price to confirm, a deposit before ticketing, zero balance before completing; closed trips are immutable.
- **Service lines**: flight/hotel/transfer/tour/visa/insurance with supplier, confirmation ref, cost and sell price. Trip price and cost recalculate from non-cancelled lines.
- **Payments**: deposits, instalment schedule with due dates, mark-paid, void; balance and overdue alerts. Overpayment is rejected.
- **Packages**: group tours with fixed price, departure date and seat limit; booking a package checks remaining seats.
- **Visas**: case per client with default document checklist and status flow.
- **Suppliers**: directory with archive.
- **Overview**: pipeline, upcoming departures, outstanding balances, revenue, margin, overdue instalments, passport alerts.

## Files
- `prisma/schema.prisma` + `prisma/migrations/20261109090000_travel_agency` (additive: 8 new tables, no changes to existing tables)
- `lib/travel.ts` (constants and pure helpers), `lib/actions/travel.ts` (store-scoped, permission + entitlement checked server actions)
- `components/dashboard/travel-workspace.tsx`, `app/store/[slug]/admin/travel/page.tsx`
- Wiring: `lib/plugins.ts`, `components/dashboard/plugin-use-button.tsx`, `app/store/[slug]/admin/apps/[pluginKey]/page.tsx`, `app/store/[slug]/admin/apps/page.tsx`, `lib/constants/dashboard-nav.ts`, `lib/page-guides.ts`
- Tests: `lib/__tests__/travel.test.ts`

## Security model
Every action calls `assertStorePermission(slug, "plugin:travel-agency")`, then checks plugin entitlement, installation and business type. Every query is filtered by `storeId`; child rows (travellers, items, payments) are only reached through a trip that belongs to the store.

## Verified here / still to do on your side
Verified: Prisma schema validates, client generates, `tsc` reports no errors in the new or edited files (50 existing errors are all in unrelated `*.test.ts` files), new unit tests pass.
Not verified (no database or network in this sandbox): `prisma migrate deploy`, and a click-through in the browser. Run `npm run build`, then install the app from Apps on a Travel & Tourism store and test with two stores to confirm isolation.

## Storefront (Wanderly Travel template)
When a Travel store uses the **Wanderly Travel** template and has this app installed, the homepage shows a "Group Tours & Departures" section (price per person, departure date, seats left) and an enquiry form.
- `lib/travel-public.ts` reads open packages; `lib/actions/travel-public.ts` receives enquiries and creates an ENQUIRY trip file for the agency to follow up.
- Price always comes from the package, not the browser. Enquiries do not hold seats; seats are held only by CONFIRMED/TICKETED/TRAVELLING/COMPLETED trips, and the seat check runs again when an agent confirms a trip.
- Abuse protection: hidden honeypot field, per-IP (5 per 10 min, 20 per hour) and per-store limits, max 5 open enquiries per contact.

## Online payments (Book now + payment links)
New payment purpose `TRAVEL_BOOKING`, reference prefix `TVL-<tripId>-<token>`, built by copying the PMS reservation deposit flow.
- **Book now** (storefront): visitor picks a tour, we create the client + ENQUIRY trip and send them to pay the package's deposit (`depositPercent`, default 30%, 100 = pay in full, 0 = enquiry only) for all travellers. Only NGN tours can be paid online.
- **Payment link** (admin, trip > Payments): creates a checkout link for any amount up to the balance, copied to the clipboard to send to the traveller.
- Routes through the store's own gateway keys or the platform gateway (Paystack, Flutterwave, Korapay), or the store's bank-transfer page when no gateway applies (the agency then confirms the transfer, which runs the same settlement).
- **Settlement** (`lib/payments/settle-travel.ts`): verifies provider and amount (underpayment refused, gateway-fee overpayment accepted), marks the payment successful once, records a `TravelPayment` on the trip (unique per gateway reference), confirms the trip if it was an enquiry/quote and seats remain, then posts to the ledger and queues the vendor payout.
- If the tour sold out between booking and payment, the trip stays an enquiry and a warning is logged so the agency can refund or move the traveller. A payment on a cancelled trip is logged for refund too.
- Touched core money paths (same pattern as PMS): `lib/payments/{pending,manual-flow,payout,confirm-destination}.ts`, `lib/actions/manual-payment.ts`, the Paystack/Flutterwave/Korapay webhook and callback routes, and the payment-reconciliation cron.

### Not covered
- **Refunds of travel payments are manual.** Voiding a payment in the workspace does not refund the traveller through the gateway; refund from the gateway dashboard, then void the entry.
- Nothing here has been run against a real gateway or database.

### Launch checklist
1. `prisma migrate deploy` (two migrations: enum value, then columns/indexes).
2. Sandbox/test keys: book a tour with a card, confirm the trip turns CONFIRMED, one TravelPayment exists, the Payment is SUCCESSFUL and a payout row is created. Replay the webhook: nothing should double up.
3. Pay with bank transfer (no gateway): confirm in Payments > pending transfers, same result.
4. Two stores: store A's staff must not see or pay store B's trips; a package id from store B posted to store A's storefront must be refused.
5. Fully booked tour: enquiry and Book now are both refused; sell the last seat while a second checkout is open and confirm the late payer is flagged, not overbooked.
6. Repeat the above on Paystack, Flutterwave and Korapay if you use more than one.

## Traveller receipt email
When a tour payment settles, `lib/payments/travel-confirmation.ts` emails the traveller (the client's email on file) under the agency's own name and branding: booking reference, travellers, departure, amount paid, total, balance remaining and a link to the booking-status page. The subject is "Booking confirmed" when the trip is confirmed, or "Payment received" when it is not yet (for example the tour sold out meanwhile), and the body says so.
- Sent once: only by the call that actually settled the payment, so webhook replays, the browser callback and the reconciliation cron do not resend.
- Skipped when the client has no email. A failed send is logged and never affects the payment.
- Not sent to the agency. Agency-side alerts (new paid booking, sold-out refund needed) are still only in the logs and the workspace.

## Agency alerts
When a tour payment settles, the agency owner gets a dashboard notification (type `TRAVEL_PAID`) and an email (`notifyAgencyOfTravelPayment` in `lib/payments/travel-confirmation.ts`). Payments that need a human are titled "Action needed": the tour was full when the payment arrived (trip left unconfirmed; refund or move the traveller, then void the payment on the trip), or the trip was already cancelled (refund likely due). Sent once per settled payment, never throws.

## Client PDFs and refunds (added after the first review)

**PDF quote / invoice / itinerary.** `GET /api/store/[slug]/travel/[tripId]/document?type=quote|invoice|itinerary`
(staff only, same checks as the workspace). Built in `lib/travel-documents.ts`. Never prints cost, margin, supplier
names, passport numbers or internal notes. The itinerary groups service lines by their start date, so lines need dates
(the Add service form now has Start and End date).

**Refunds.** `requestTravelRefund` (lib/actions/travel.ts) -> `refundTravelPayment` (lib/payments/refund-travel.ts).
- One refund per payment. Partial refunds are allowed (the agency keeps the rest, e.g. a cancellation fee); the
  payment stays RECEIVED with `refundedAmount` set. A full refund moves it to REFUNDED. `tripMoney().paid` is net of refunds.
- Online payments (a gateway `Payment` shares the `TravelPayment.reference`): the gateway `Payment` is claimed
  (SUCCESSFUL -> REFUND_PENDING, with the intended amount) before the gateway is called, then the refund goes back through
  the provider that took the money. A decline releases the claim. If the gateway accepts but local recording fails, the
  payment stays REFUND_PENDING; a platform admin finishes it with `reconcileRefundPendingPayment`, which is now
  partial-refund and travel aware.
- Vendor payouts follow the refund: unsent payouts are cancelled (full) or reduced pro rata (partial); sent payouts
  create a clawback for the refunded share.
- Manual payments (cash, transfer, POS): the refund is recorded only. BizNest moves no money and the UI says so.
- Voiding a payment that was taken online is blocked; use Refund. A refunded payment can't be voided.
- Travel payments are not posted to the Financial Control ledger today, so refunds are not either.
- Migration: `20261116090000_travel_payment_refunds` (adds columns to TravelPayment, no data changes).
