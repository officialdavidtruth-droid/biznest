# Template reference image integration

This update adds the 11 uploaded visual references to `public/template-reference-previews/` and uses them as lazy-loaded visual cover art in the existing template gallery. The storefront's products, services, prices, and categories must continue to be read from the store's real catalog; these reference images are not treated as product data and are not inserted into a merchant's inventory.

## Included reference styles
- Luxury hotel (dark editorial)
- Luxury hotel (bright editorial)
- General marketplace / home goods
- Blue electronics store
- Mobile-first technology store
- Red-and-white general ecommerce
- Blue ShopNova ecommerce
- TechVerse gadget shop
- Wanderly travel booking
- Skyview hotel resort
- Nestoria real estate

## Notes
The reference cover mapping is in `components/dashboard/template-gallery.tsx`. It selects a cover by template name/category and falls back to the existing live iframe preview for unmatched templates. The images are only visual references; they do not replace the existing storefront renderers or change database records.
