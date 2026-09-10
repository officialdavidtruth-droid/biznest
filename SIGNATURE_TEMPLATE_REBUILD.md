# BizNest Signature Screenshot Template Rebuild

This build keeps the production BizNest routing, cart, checkout, customer account and template infrastructure while rebuilding the screenshot-reference storefronts as distinct visual systems.

## Screenshot reference templates rebuilt
- Great Treasure Global Hotel & Suites — dark green/black luxury hospitality, gold accents, room booking + food ordering sections.
- Grand Vere Hotel & Resort — white/cream luxury resort, dark green accents, serif editorial presentation, rooms, amenities, dining, gallery, location and FAQ.
- Belora Skincare — white/lavender beauty commerce, category circles, benefits, editorial self-care section, best sellers and brand story.
- TasteHouse — food delivery marketplace with left sidebar, search bar, cuisine discovery, popular dishes, offers and trusted-by strip.
- Flavora Kitchen — white/red restaurant ordering design with category circles, popular dishes, promotional card and chef's special.
- Flavora Restaurant — cream/black/orange restaurant editorial design with hero, about/experience, popular dishes and reservation CTA.

## Journey consistency
The production route system remains intact. Template mode is carried into catalog/product/service/cart/checkout/confirmation surfaces through `signature-journey.tsx`, `signature-cart-client.tsx`, `signature-checkout-client.tsx`, and `signature-order-confirmation.tsx`.

## Important implementation rule
These screenshot templates intentionally do not share one generic homepage composition. Shared business logic is retained, but layout, hierarchy, navigation treatment, typography, spacing, surfaces and CTA presentation are mode-specific.
