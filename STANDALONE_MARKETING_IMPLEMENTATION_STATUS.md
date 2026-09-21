# Standalone Marketing Tool — implementation status

## Included in this package
- Homepage marketing-tool CTA linking to `/marketing`.
- Standalone marketing landing page and onboarding UI (no store onboarding / no ID field).
- Client-side CSV/TXT email-list parsing, basic email validation, duplicate removal, preview, and cleaned CSV export.

## Not yet production-connected (must be completed before launch)
This is not a complete paid SaaS implementation. The existing project must still wire these UI surfaces to server-side authentication, database persistence, payment verification, subscription enforcement, Superadmin pricing controls, and tenant isolation. The onboarding form intentionally does not claim to create an account or activate a subscription.

## Excel format
The current import accepts CSV/TXT. Users can open `.xlsx`/`.xls` in Excel or Sheets and export as CSV. Native Excel workbook parsing is not included because the project does not currently declare an XLSX parser dependency.

## Production checklist
1. Add Prisma models and migrations for standalone marketing account membership, subscription status, contacts, and campaigns.
2. Add server actions/API routes with session checks and per-account ownership filters on every query.
3. Add checkout using the project's supported payment provider; activate only from verified provider webhook/server verification.
4. Add Superadmin-only settings for monthly price and product availability; never trust client-supplied prices.
5. Gate all marketing API actions server-side on active subscription.
6. Implement secure Excel/CSV parsing server-side, import limits, consent/source tracking, suppression/unsubscribe handling, and rate limits.
7. Add tests for cross-account isolation, unpaid access denial, webhook idempotency, and import validation.
