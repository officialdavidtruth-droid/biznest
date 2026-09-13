# TasteHouse — Food Delivery Template

Implemented as an independent BizNest storefront template using the approved generated TasteHouse designs as the visual source of truth.

## Customer pages
- Home
- Menu
- Categories
- Offers
- Reservations
- Orders
- Reviews
- Support
- Cart
- Checkout
- Order confirmation
- Track Order
- Store-scoped customer Account/Profile remains available through the shared customer authentication system.

## Interactions
- Sidebar navigation and header account/cart controls are real routes.
- Cuisine/category cards link into filtered Menu views.
- Menu category tabs filter the displayed dishes.
- Add buttons use the shared store-scoped cart.
- Cart quantity/remove/clear controls work client-side.
- Checkout submits through the shared BizNest checkout gateway.
- Confirmation and order tracking are store/order scoped.
- Reservation form uses the shared booking action when a published bookable restaurant service exists.
- Review/Support UI is interactive and routes into existing customer/admin infrastructure.

## Admin
TasteHouse Website is exposed under the store admin Website group. Existing admin modules remain the source of truth for products, categories, coupons, bookings, orders, reviews and customers. The TasteHouse Website panel controls hero/promotional/support content stored per store in StorePage.

## Isolation
The template is selected by StoreTemplate name and does not replace or redesign Grandeur or Veloura. Shared payment, cart, authentication and core operations remain shared infrastructure.
