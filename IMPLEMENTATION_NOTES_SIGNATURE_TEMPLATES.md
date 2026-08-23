# BizNest Signature Template Collection

The current project now includes a new 13-template collection rendered by `SignatureStorefront`.

Templates:
- Electra — Smart Commerce
- Atelier — Modern Fashion
- Kinetic — Sneaker Drop
- Bloom — Beauty Boutique
- Haven — Home & Furniture
- Harvest — Grocery Market
- Maison — Hotel & Stay
- Ember — Restaurant
- Muse — Salon & Beauty
- Frame — Photography Studio
- North — Creative Agency
- Pure — Cleaning Services
- Forge — Construction

These are not palette-only variants. The renderer has distinct industry modes for navigation, hero composition, editorial sections, catalog presentation, CTA language, density, dark/light surfaces, and hospitality/service-specific messaging.

The templates are seeded by `prisma/seed.ts` and the production bootstrap route `app/api/seed-platform-data/route.ts`. The storefront dispatcher selects them by StoreTemplate name before the legacy template renderers.
