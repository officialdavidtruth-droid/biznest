# BizNest order page audit: fixes (steps 1-10)

Every file below sits at its repo-relative path. Copy the folder contents over the repo root.
Static changes only: not type-checked or tested (dependencies were not installed in the sandbox).

| Step | Fix | Files |
|---|---|---|
| 1 | Server-side order status transitions, dispute guard, compare-and-swap + transaction | lib/constants/order.ts, lib/actions/order.ts, components/dashboard/order-status-control.tsx |
| 2 | No merchant cancel on paid orders (use Issue refund); hint in UI | lib/constants/order.ts, components/dashboard/order-status-control.tsx |
| 3 | Confirmation page shows honest status notice for pending/cancelled/refunded/disputed orders, with polling for pending gateway payments | app/store/[slug]/orders/[orderId]/confirmation/page.tsx, components/storefront/order-status-notice.tsx, components/storefront/order-status-poller.tsx |
| 4 | Track links no longer 404 (default button -> order list; TasteHouse per-order track; fallback redirect) | components/storefront/order-confirmation.tsx, app/store/[slug]/orders/[orderId]/track/page.tsx, app/store/[slug]/orders/track/page.tsx |
| 5 | "Total spent": paid orders only, per-currency | app/store/[slug]/orders/orders-list-content.tsx |
| 6 | Hide never-paid CANCELLED orders from buyer history | lib/actions/order.ts |
| 7 | Admin money block: delivery fee, "Customer paid", commission only when > 0 | app/store/[slug]/admin/orders/[orderId]/page.tsx |
| 8 | Legacy /orders no longer renders a blank page | app/orders/page.tsx |
| 9 | Order list pages: one store query instead of three, orders + awaiting-transfer fetched in parallel, unused imports removed, note when the 200-order cap is hit | app/store/[slug]/orders/page.tsx, app/store/[slug]/orders/orders-list-content.tsx |
| 10 | Dispute actions now accept the storefront customer cookie; buyers were locked out of their own disputes | lib/actions/dispute.ts |

lib/actions/order.ts, lib/constants/order.ts, order-status-control.tsx and orders-list-content.tsx are cumulative across steps.

To verify: run tsc, the existing order/refund tests, and manually open a TasteHouse order's tracking page.
