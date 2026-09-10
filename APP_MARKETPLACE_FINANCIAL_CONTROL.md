# BizNest App Marketplace + Financial Control

This build introduces a platform-managed plugin marketplace.

## Store admin

`/store/[slug]/admin/apps` lists available apps, installed state, price, supported plans and business eligibility. Paid apps are purchased through the existing Paystack flow. Apps that are not supported by the store subscription return an upgrade-required message and never become accessible through direct URL entry.

## SupaAdmin

`/supaadmin/apps` controls plugin price, free/included status, billing interval, publication state, eligible business types and supported subscription plans. Existing configuration is preserved when the catalog is reconciled.

## PMS

PMS is migrated conceptually into the plugin entitlement layer. Existing Business Mogul hotel stores are automatically backfilled with an active PMS StorePlugin record, so the marketplace migration does not lock out existing PMS users.

## Financial Control

The first production foundation includes:

- chart of accounts with system defaults
- double-entry journals with balance enforcement
- expense capture and approve/post workflow
- open/closed accounting periods
- Profit & Loss and trial-balance views
- cash and bank account balances
- financial audit activity
- staff `finance` permission
- paid plugin purchase and recurring monthly/yearly renewal state

Posted journals are not deleted by this module; corrections should be represented by reversing entries.

The next expansion layer can add bank feeds/reconciliation, AP/AR, tax/VAT, budgets, fixed assets/depreciation, payroll integration, departmental P&L, automated posting from orders/POS/PMS/invoices, exports, and accountant/auditor read-only roles.
