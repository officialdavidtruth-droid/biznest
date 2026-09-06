# Inventory ledger reconciliation

This patch adds a read-only inventory audit to the merchant inventory page.

## What it verifies

- Simple products are reconciled against their `InventoryItem` movement ledger.
- Active variants are reconciled against their `ProductVariant` movement ledger.
- Every movement's `quantityAfter` must equal the previous running balance plus `quantityChange`.
- The final ledger quantity must equal the stored current quantity.
- Legacy stock with no movement history is reported as `NO_LEDGER`, not falsely treated as a discrepancy.

## Safety

The audit never changes stock and never auto-repairs discrepancies. Corrections must remain explicit merchant/staff actions so the audit trail stays explainable.

The dashboard audits up to 500 simple inventory items and 500 active variants per store to keep the admin page bounded. Each selected stock item's full recorded movement history is checked.
