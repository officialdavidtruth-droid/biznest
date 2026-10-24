# Reference storefront templates

This update adds 11 selectable template definitions to the shared template registry and Prisma seed catalog. These are live storefront renderers, not screenshot-only cards. Storefront products/services, images, prices, categories, reviews, contact details and store identity are supplied from the merchant's existing BizNest data.

## Added templates
- Aspire Resort — hotel renderer
- Larita Luxury Hotel — hotel renderer
- Emarket Furniture & Home — marketplace renderer
- Electra Blue Electronics — marketplace commerce renderer
- TechNova Mobile Store — premium commerce renderer
- ShopEase General Store — violet commerce renderer
- ShopNova Marketplace — marketplace renderer
- TechVerse Gadgets — premium commerce renderer
- Wanderly Travel — editorial renderer
- Skyview Hotels & Resorts — hotel renderer
- Nestoria Real Estate — real-estate renderer

## Apply to database
Run the existing seed command in your project environment after deploying the code:

`npm run db:seed`

The seed uses upserts and retains existing merchant template references. Then refresh the template gallery. Template access remains subject to the store's subscription tier and compatibility rules.

Note: the reference layouts are mapped to existing BizNest storefront layout families. Some are theme/layout adaptations rather than pixel-perfect recreations of the supplied screenshot; their storefront content is data-driven and does not use the reference images as product data.
