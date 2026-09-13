# Example — Modern Electronics Store

Implemented from the approved generated reference designs for the Example electronics storefront.

## Storefront journeys
- Homepage with hero, category shortcuts, promotions, collections, flash deals, new arrivals, best sellers, trust row, app promotion, newsletter and footer.
- Clickable Categories page and header Categories mega-menu with subcategories.
- Deals, New Arrivals, Brands and All Products pages.
- Cart with quantity controls, removal, wishlist affordance and checkout CTA.
- Three-stage Checkout → Payment → Review flow with persisted shipping details.
- Payment submission uses the shared BizNest checkout/payment engine; when inline provider configuration is available, the card checkout stays in the storefront and uses the store's connected payout account.
- Successful payment returns to the existing verified order confirmation flow.
- Order confirmation and order tracking pages.
- Store-scoped customer account/profile shell and profile dashboard.

## Merchant controls
`/store/[slug]/admin/example` controls approved template copy: hero text, promotions, audio/camera promos, newsletter and footer copy. Product catalog, pricing, inventory, categories, orders, customers, delivery and payment connections remain controlled by the existing BizNest admin modules.

## Persistence
Example template content is stored under `Store.sectionOverrides.exampleContent`, so this template does not require a new schema table and does not interfere with Grandeur, Veloura or TasteHouse content.

## Template registration
Migration: `prisma/migrations/20260912170000_add_example_template/migration.sql`

Template name: `Example — Modern Electronics Store`
