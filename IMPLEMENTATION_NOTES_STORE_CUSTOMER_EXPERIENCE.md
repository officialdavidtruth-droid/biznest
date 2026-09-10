# Store Customer Experience / Isolation Pass

Implemented a store-private customer environment.

## Customer boundary
- Store-branded customer login requires a `StoreCustomer` membership for that exact store.
- Customer login without a store context is rejected; generic login remains for owners/staff.
- Store signup creates the store membership and `StoreCustomerProfile`.
- Store customer sessions carry `customerStoreId`; account pages still verify membership server-side on every request.
- Store checkout and service booking reject a customer session that belongs to another store.
- Google sign-in is hidden in store customer login/signup because the current OAuth callback cannot safely establish a store membership from the store context.

## URLs
Customer account UI now lives under:
- `/store/[slug]/account`
- `/store/[slug]/account/orders`
- `/store/[slug]/account/wishlist`
- `/store/[slug]/account/addresses`
- `/store/[slug]/account/loyalty`
- `/store/[slug]/account/bookings`
- `/store/[slug]/account/reviews`
- `/store/[slug]/account/messages`

Legacy `/account/*` pages no longer render a cross-store dashboard. `/orders` is also a compatibility boundary and redirects to the customer's store when possible.

## Data isolation
Added direct store-scoped records/fields for:
- `StoreCustomerAddress`
- `StoreLoyaltyAccount` / `StoreLoyaltyEntry`
- `WishlistItem.storeId`
- `RecentlyViewed.storeId`
- `FavoriteBusiness.storeId`
- `Conversation.storeId`

Existing addresses are copied only when the customer has exactly one store membership. Existing global loyalty balances are intentionally not copied because there is no safe way to attribute a platform-wide balance to one merchant.

## Security hardening
- Buyer order history and order confirmation are store-scoped.
- Dispute access verifies the buyer's membership in the order's store.
- Dispute conversations are tagged with their store.
- Wishlist, recently-viewed, favorites and saved-cart writes enforce store membership for customer-role sessions.
- Store-specific password-reset links contain the store context and verify membership before changing the password.

## Theme
The store account shell inherits the store's logo/name, accent color and configured font. The account routes remain nested under the store shell so account navigation/footer stays visually tied to the storefront.
