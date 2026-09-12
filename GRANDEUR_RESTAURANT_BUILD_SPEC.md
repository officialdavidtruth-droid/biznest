# Grandeur Restaurant — Approved Build Contract

## Non-negotiable rule
The approved restaurant screenshots generated in this conversation are the visual source of truth. Production implementation must not redesign, simplify, substitute, or add sections to these screens without explicit approval.

## Approved customer journey
1. Home
2. Menu
3. Reservations
4. About
5. Gallery
6. Events
7. Contact
8. Cart
9. Checkout
10. Payment
11. Confirmation
12. Track Your Order

## Visual direction
- Five-star / fine-dining presentation.
- Black / deep brown / cream / white / warm gold palette.
- Editorial serif headlines with clean sans-serif UI text.
- Premium food and restaurant photography.
- Full-width cinematic hero areas.
- Strong spacing, clean cards, subtle borders and restrained shadows.
- Nigerian context: Abuja, NGN pricing and +234 contact format.

## Interaction contract
- Header navigation routes to its own page.
- Menu categories and dish cards are clickable.
- Dish cards can add to the store-scoped cart.
- Cart quantity controls, remove and checkout controls work.
- Checkout continues to the dedicated payment screen.
- Payment uses BizNest's shared secure payment infrastructure; the restaurant presentation remains independent.
- Successful payment returns to the existing order confirmation flow.
- Confirmation links to Track Your Order and Home.
- Customer account remains scoped to the current store; Store A customers must never be mixed with Store B.
- Reservation, gallery, event and contact actions remain visibly actionable.

## Architecture contract
- Restaurant storefront presentation is isolated in `components/storefront/grandeur-restaurant.tsx`.
- Restaurant routing is isolated through restaurant-specific page routes and category detection.
- Hotel and professional-service storefront renderers are not modified by the restaurant presentation layer.
- Cart, customer authentication and payment are shared BizNest infrastructure, as intentionally approved.
- Restaurant-specific UI must not be implemented by reusing another industry's visual template.
