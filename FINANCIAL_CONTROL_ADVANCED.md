# Financial Control — Advanced Finance Layer

This layer extends the Financial Control plugin with operational finance controls without changing the existing double-entry foundation.

## Included

- Accounts receivable view from issued BizNest invoices.
- Accounts payable view from supplier purchase orders.
- Bank/cash account register linked to a ledger asset account.
- Bank transaction reconciliation queue with match/ignore states.
- Budget register with account-level approved limits.
- Fixed asset register using straight-line monthly depreciation.
- Working-capital and fixed-asset reporting cards.
- Audit events for bank, budget and asset changes.

## Accounting safety

- Bank accounts are store-scoped.
- Bank transactions cannot be attached to another store.
- Budget lines can only reference active accounts belonging to the store.
- Assets validate useful life, purchase cost and residual value.
- Depreciation cannot exceed depreciable cost.
- Closed accounting periods remain protected by the existing posting checks.

## Next integrations

The next production layer should post verified events from Orders, POS, Invoices, PMS and Refunds directly into the general ledger, then add VAT/tax configuration, bank statement import, approval thresholds, department/cost-centre accounting and auditor exports.
