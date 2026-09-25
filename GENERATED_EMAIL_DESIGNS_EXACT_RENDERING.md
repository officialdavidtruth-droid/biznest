# Generated Email Designs — Exact Renderer

The marketing composer now treats the generated/reference-quality email designs as the source of truth for the customer-facing gallery and renderer.

## What changed

- The 12 generated designs are the curated gallery:
  - Dark Menu
  - Food Catalog
  - Restaurant Story
  - Signature Offer
  - Brand Editorial
  - Customer Thank You
  - Booking Confirmation
  - Pricing & Packages
  - Hotel Showcase
  - Journey & Experiences
  - Curated Catalog
  - Product Launch
- Legacy templates remain registered so previously created campaigns can still render.
- The generated designs use dedicated HTML compositions rather than the older generic template renderers.
- The same `renderMarketingEmail()` output powers the live preview and campaign HTML.
- Website-derived logo, colours, business type, catalog items, links and contact details continue to flow into the generated layouts.
- Curation remains deterministic/rule-based; no AI/model call is used to choose templates.

## Validation

- TypeScript transpile validation passes for the marketing renderer, curation tests and email designer.
- Runtime smoke tests successfully rendered the hotel, restaurant, product launch, dark menu and editorial generated templates.
