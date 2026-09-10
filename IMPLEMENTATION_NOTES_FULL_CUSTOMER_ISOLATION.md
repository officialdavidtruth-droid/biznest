# Full Store Customer Isolation

Implemented on the store-customer experience layer.

## Boundary
- Customer sessions carry `customerStoreId` at sign-in.
- `/store/[slug]/account/*` requires role CUSTOMER and an exact match between the route store and the session's `customerStoreId`.
- Customer actions use `requireStoreCustomer()` or `requireStoreCustomerByStoreId()` rather than user-only membership lookups.
- Wishlist, addresses, saved carts, recently viewed, favorites, loyalty, reviews, conversations, bookings, orders and disputes are queried with the store boundary.
- The legacy `/account/*` area is only a compatibility boundary and never renders a cross-store dashboard.
- Generic customer login without a store context is rejected. Store-branded login is required for customers.
- Store-branded signup is the customer registration path. Google OAuth remains unavailable in store context so OAuth cannot create a customer session without store membership context.

## Important
The existing `User` model remains the platform authentication identity used by owners/staff and existing order relations. Customer access is isolated at the store-membership/session/data-access boundary rather than replacing the platform identity model. A customer session cannot use its Store A context to read or mutate Store B customer data.
