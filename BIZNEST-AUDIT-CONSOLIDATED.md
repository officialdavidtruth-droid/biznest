# BizNest Consolidated Audit Build

This archive is the consolidated working build containing the audited/fixed BizNest source currently in the workspace.

## Included hardening and fixes
- Authentication webhook failure isolation and slug validation/collision hardening.
- Business verification rejected-resubmission and guarantor reset handling.
- Store creation/template validation and slug safety.
- Niche/template compatibility and starter listing selection.
- Storefront `/store/[slug]` route/CTA/navigation corrections.
- Universal/niche section-page routing and booking/contact conversion fixes.
- Quote request workflow: real Quote + CreativeProject records, reference uploads, admin detail routing, notifications, and customer redirect.
- Booking concurrency, duplicate protection, payment retry, payment-initiation failure handling, 30-minute online pending holds, and cancellation/payment race protection.
- PMS reservation payment lifecycle protection.
- Paystack/Flutterwave payment settlement idempotency and amount verification.
- Gateway refund lifecycle, REFUND_PENDING race protection, reconciliation, refund webhooks, and inventory restoration on refunds.
- Order payment/stock idempotency and linked SALE stock movements.
- POS sale idempotency.
- Inventory/variant/purchase-order concurrency hardening.
- Product edit, bulk editor, and CSV inventory ledger/concurrency hardening.
- Variant-vs-parent inventory source-of-truth alignment across storefront/admin/analytics.
- Inventory ledger reconciliation tooling that flags missing ledgers, discrepancies, and ledger corruption without silently repairing stock.

## Important
This is a source consolidation of the current audited working tree. It does not include `node_modules`, build output, secrets, or environment-specific generated artifacts.

Database migrations included in `prisma/migrations` are part of the build and should be applied through the project's normal Prisma deployment workflow.
