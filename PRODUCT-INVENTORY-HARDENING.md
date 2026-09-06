# Product edit inventory hardening

Product edits no longer silently overwrite on-hand inventory.

- Quantity changes are executed in a Serializable transaction.
- Existing inventory updates use a compare-and-set quantity guard.
- A quantity change creates an order-independent `CORRECTION` StockMovement.
- Concurrent inventory changes cause a retry instead of a stale overwrite.
- SKU/barcode and the rest of the product edit remain part of the same transaction.
