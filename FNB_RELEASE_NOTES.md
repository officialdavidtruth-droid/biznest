# FnB Release Notes

Implemented a dedicated BizNest FnB workspace with safe vertical routing and operational controls.

### Main changes
- Dedicated `/admin/fnb` vertical workspace.
- Marketplace and installed-app links route directly to `/admin/fnb`.
- Staff permission enforcement uses `plugin:fnb-operations` for the entire FnB workspace.
- Overview dashboard expanded to sales, orders, reservations, inventory, batches, recipes and waste.
- Kitchen queue with controlled PAID -> IN_PROGRESS -> DELIVERED -> COMPLETED progression.
- Recipe editor using existing product JSON attributes.
- Supplier, procurement, customer, inventory and reservations sections connected to existing BizNest modules.
- Wastage records are appended to the stock movement ledger and consume inventory batches safely.
- FIFO and FEFO policies exposed in FnB settings.
- POS, online paid-order and inventory stock consumption now respect the selected FnB rotation policy.
