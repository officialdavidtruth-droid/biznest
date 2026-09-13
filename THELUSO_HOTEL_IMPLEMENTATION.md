# Veloura — Superior Luxury Hotel

Implemented as an independent hotel storefront alongside Grandeur Restaurant.

## Public experience
- Home
- Rooms + room detail
- Dining
- Amenities
- Events + event detail + calendar
- Gallery + category filters + lightbox
- Offers + category filters
- Contact
- Five-step booking journey: Select Dates → Choose Room → Guest Details → Add Extras → Review & Pay
- Store-scoped customer profile/account remains on the shared account system

## Admin control
`/store/[slug]/admin/hotel` provides structured editing for homepage, rooms, offers, amenities, events, gallery and contact content. Existing Services, Events and Gallery admin modules remain available for operational management.

## Booking infrastructure
Hotel room services can be configured through Admin → Services as unit-based bookable services. When a room is mapped to a service, the hotel booking flow uses the existing race-safe stay booking and payment infrastructure.
