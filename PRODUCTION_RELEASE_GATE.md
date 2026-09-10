# BIZNEST PRODUCTION RELEASE GATE

Before public production deployment:

1. Rotate any secret that has ever appeared in source, .env.example, Git history, logs,
   screenshots, or shared archives.
2. Set all production secrets only in the hosting provider's encrypted environment variables.
3. Run:
   npm ci
   npm test
   npm run lint
   npm run build
4. Run two-account authorization tests:
   - Account A cannot read/change Account B's stores.
   - Account A cannot read/change B's orders, customers, invoices, inventory, bookings,
     PMS records, analytics, or financial data.
5. Verify payment callbacks require a matching pending payment record and exact store/plan.
6. Verify invoice access uses a random access token, not a guessable database identifier.
7. Verify production cookies are Secure + HttpOnly + appropriate SameSite.
8. Review CSP and remove unsafe-inline/unsafe-eval where compatible with the deployed Next.js build.
9. Confirm no NEXT_PUBLIC_* variable contains a secret.
10. Disable all development/demo seed and bootstrap functionality in production.

This archive removes known public seed/bootstrap routes and sanitizes committed environment
examples. Static source review cannot substitute for a running two-account penetration test.
