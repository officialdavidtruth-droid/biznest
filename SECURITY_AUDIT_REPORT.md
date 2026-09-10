# BizNest Security Audit — September 2026

## Critical issues fixed in this build

1. Removed public `/api/seed-demo-user` route.
   - It could create/reset a known demo account.
2. Removed public `/api/promote-admin` route.
   - It exposed a privilege-escalation operation over HTTP, even though it required a bootstrap secret.
3. Removed public `/api/seed-platform-data` route.
   - Database seeding must not be exposed as a production GET endpoint.
4. Locked down private analytics.
   - `getDashboardInsights(storeId, slug)` now verifies the authenticated user's access to the exact store.
   - `getStoreAnalytics(storeId)` now resolves the store slug and verifies analytics permission before reading revenue, orders, customers, traffic, and product data.
5. Hardened storefront visit tracking.
   - Only active stores are accepted.
   - Per-store/IP rate limiting was added to reduce analytics inflation/abuse.
6. Hardened the Sendbox webhook.
   - It now fails closed when `SENDBOX_WEBHOOK_SECRET` is missing instead of accepting unsigned requests that can change order status.
7. Protected invoice PDFs.
   - Draft invoices are unavailable.
   - Access requires the authenticated invoice customer or authorized store staff/owner/platform staff.

## Important findings that were already handled correctly

- Passwords use bcrypt hashing.
- Login has IP and identifier rate limiting.
- Store dashboard actions generally use the shared `assertStorePermission` model.
- Many mutations scope database reads/writes with `storeId` derived from authorized store access.
- Payment webhooks contain provider-signature/verification logic.
- Admin panel uses a separate server-side PIN session.

## Remaining deployment requirements

- Rotate every production secret if the repository or environment was exposed.
- Keep all database/payment/provider secrets out of `NEXT_PUBLIC_*` variables and out of the client bundle.
- Configure `SENDBOX_WEBHOOK_SECRET`; this endpoint intentionally rejects unsigned webhooks.
- Run `npm ci`, `npm run lint`, `npm test`, and `npm run build` in CI before deployment.
- Perform an authenticated two-store test: user A must receive 403/unauthorized behavior when requesting store B's analytics, orders, customers, invoices, inventory, PMS, financial-control, and admin resources.
- Invalidate existing sessions if compromise is suspected.

## Security boundary

Frontend code is public by design. View Source, DevTools, and downloaded JavaScript cannot be reliably blocked. Security must therefore come from server-side authentication, authorization, resource ownership checks, and secret isolation.
