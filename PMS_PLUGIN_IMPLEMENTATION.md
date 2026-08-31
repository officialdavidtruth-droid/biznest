# BizNest PMS Plugin

The PMS is implemented as a hotel-only premium application inside the existing BizNest deployment at:

`/store/[slug]/admin/pms`

It intentionally replaces the normal BizNest dashboard chrome on the PMS route, so the hotel operator gets a dedicated PMS workspace instead of a cluttered shared sidebar.

## Access

- Business type: `Hotel & Lodging`
- Subscription: `Business Mogul`
- Server-side entitlement enforcement lives in `lib/actions/pms.ts`.
- The normal BizNest navigation exposes the PMS under `Apps` only when both conditions are met.
- Non-Mogul hotel owners are redirected to Subscription with an upgrade message.

## Current operational modules

- Dashboard
- Reservations
- Seven-day room calendar
- Front Desk
- Room inventory/status
- Housekeeping/readiness
- Guest profiles
- Billing & reservation payments
- Room, guest and reservation creation
- Check-in / check-out
- Cancellation / no-show
- Payment-link generation using the existing BizNest Paystack/Flutterwave flow

## Deployment model

No additional domain is required. This is designed for the current Vercel Hobby setup and uses the existing BizNest domain/path. The PMS UI is separated at the application/layout level so it can later be moved to `pms.biznest.space` without redesigning the PMS itself.

## Database

This build deliberately reuses the existing PMS/property models already present in the project (`PropertyRoom`, `PropertyGuest`, `PropertyReservation`) and therefore does not require a new Prisma migration for this UI/plugin phase.
