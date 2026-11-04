# Template consistency audit (home page to last page)

> **UPDATE after the "fix all" pass.** The tables below are the audit as first written (before the fixes). What changed:
>
> | Gap found | Status |
> |---|---|
> | Builder templates: product and service pages used a second header/footer | **Fixed.** Both go through `StorefrontShell`, which picks the Builder chrome when the home page is Builder. |
> | Builder templates: cart had a bare header and no footer | **Fixed.** The cart is wrapped like every other page. |
> | Blog always used the Builder chrome | **Fixed.** Blog uses the Builder chrome for Builder stores and the template's own skin for all others. |
> | Ember (restaurant) and any Builder template on a restaurant business jumped to the Grandeur design on menu, category, cart, checkout and contact | **Fixed.** Grandeur is used only when the template itself is Grandeur. |
> | A published Customize layout was ignored by catalog, category, search, checkout, cart | **Fixed.** They use `usesTemplateChromeFor(name, sectionOverrides)`. |
> | Templates with their own home (legacy, signature, example, TasteHouse) and hotel templates: inner pages are a generic skinned header/footer, not the template's own | **Not fixed.** `KNOWN_CHROME_GAPS` in `template-consistency.test.ts` lists what is left (about 60 entries, all own-home or hotel). Fixing it means extracting each template's own header and footer into a reusable component, one template at a time. |
>
> 35 gaps closed; the test fails if a new one appears.


Question: which templates use two different templates (two different header/footer designs) across the site?
Answer: all 45 public templates do. None is fully consistent. Generated from `lib/storefront/chrome.ts` (`pageChrome`), which mirrors what each route does. Read from code, not from a running site.

## What the names mean
- **builder** = the Builder header/footer (`BuilderHeader`/`BuilderFooter`).
- **universal** = a second, generic header/footer (`TemplateShell`), coloured to match the template but a different design.
- **cart-inline** = a bare header with no footer, used only by the cart.
- **hotel / grandeur / legacy:... / signature:...** = a template's own header/footer.
- **Blog** = the blog pages always use `builder`, whatever the template (`components/storefront/blog-views.tsx`).

## Group A: 24 Builder templates (home = builder)
Home, category, contact and blog match. Two pages do not:
- **Product page** uses `universal`, a different header/footer than the home page.
- **Cart** uses `cart-inline`, a bare header and no footer.

| Template | Home page | Product | Category | Contact | Cart | Blog |
|---|---|---|---|---|---|---|
| Emarket Furniture & Home | builder | universal | builder | builder | cart-inline | builder |
| Electra Blue Electronics | builder | universal | builder | builder | cart-inline | builder |
| TechNova Mobile Store | builder | universal | builder | builder | cart-inline | builder |
| ShopEase General Store | builder | universal | builder | builder | cart-inline | builder |
| ShopNova Marketplace | builder | universal | builder | builder | cart-inline | builder |
| TechVerse Gadgets | builder | universal | builder | builder | cart-inline | builder |
| Heenzy — Boutique Rose | builder | universal | builder | builder | cart-inline | builder |
| Nova Studio — Ivory Minimal | builder | universal | builder | builder | cart-inline | builder |
| Violet — Sunset | builder | universal | builder | builder | cart-inline | builder |
| Electra — Smart Commerce | builder | universal | builder | builder | cart-inline | builder |
| Atelier — Modern Fashion | builder | universal | builder | builder | cart-inline | builder |
| Kinetic — Sneaker Drop | builder | universal | builder | builder | cart-inline | builder |
| Haven — Home & Furniture | builder | universal | builder | builder | cart-inline | builder |
| Harvest — Grocery Market | builder | universal | builder | builder | cart-inline | builder |
| Muse — Salon & Beauty | builder | universal | builder | builder | cart-inline | builder |
| Frame — Photography Studio | builder | universal | builder | builder | cart-inline | builder |
| North — Creative Agency | builder | universal | builder | builder | cart-inline | builder |
| Pure — Cleaning Services | builder | universal | builder | builder | cart-inline | builder |
| Forge — Construction | builder | universal | builder | builder | cart-inline | builder |
| Vitalis — Clinic & Care | builder | universal | builder | builder | cart-inline | builder |
| Pulse — Fitness & Wellness | builder | universal | builder | builder | cart-inline | builder |
| Gala — Events & Celebrations | builder | universal | builder | builder | cart-inline | builder |
| Transit — Logistics & Delivery | builder | universal | builder | builder | cart-inline | builder |
| Talent — Recruitment & HR | builder | universal | builder | builder | cart-inline | builder |

## Group B: 15 templates with their own home page (14 legacy + Bloom)
Only the home page has the template's own header/footer. Product, category, contact and cart use `universal`, and the blog uses `builder`. A visitor can see three designs in one visit.

| Template | Home page | Product | Category | Contact | Cart | Blog |
|---|---|---|---|---|---|---|
| Wanderly Travel | legacy:Wanderly Travel | universal | universal | universal | universal | builder |
| Nestoria Real Estate | legacy:Nestoria Real Estate | universal | universal | universal | universal | builder |
| Fresh & Co. | legacy:Fresh & Co. | universal | universal | universal | universal | builder |
| Heenzy Sneaker Co. | legacy:Heenzy Sneaker Co. | universal | universal | universal | universal | builder |
| Nova Studio — Noir | legacy:Nova Studio — Noir | universal | universal | universal | universal | builder |
| Violet | legacy:Violet | universal | universal | universal | universal | builder |
| Premium Marketplace | legacy:Premium Marketplace | universal | universal | universal | universal | builder |
| HomeVista | legacy:HomeVista | universal | universal | universal | universal | builder |
| rRW Premium Rental | legacy:rRW Premium Rental | universal | universal | universal | universal | builder |
| Marketplace Hub | legacy:Marketplace Hub | universal | universal | universal | universal | builder |
| Arcova Architecture | legacy:Arcova Architecture | universal | universal | universal | universal | builder |
| Rivora Fresh | legacy:Rivora Fresh | universal | universal | universal | universal | builder |
| JuiceLife | legacy:JuiceLife | universal | universal | universal | universal | builder |
| Fabtex | legacy:Fabtex | universal | universal | universal | universal | builder |
| Bloom — Beauty Boutique | signature:belora | universal | universal | universal | universal | builder |

## Group C: 5 hotel templates
Home, category and contact use the hotel design. Product and cart use `universal`, and the blog uses `builder`.

| Template | Home page | Product | Category | Contact | Cart | Blog |
|---|---|---|---|---|---|---|
| Aspire Resort | hotel | universal | hotel | hotel | universal | builder |
| Larita Luxury Hotel | hotel | universal | hotel | hotel | universal | builder |
| Skyview Hotels & Resorts | hotel | universal | hotel | hotel | universal | builder |
| Maison — Hotel & Stay | hotel | universal | hotel | hotel | universal | builder |
| Grand — Hotel & Hospitality | hotel | universal | hotel | hotel | universal | builder |

## Group D: Ember — Restaurant (the clearest "two templates")
Its home page is a Builder template, but for a restaurant business the category, contact and cart pages switch to the Grandeur restaurant design.

| Template | Home page | Product | Category | Contact | Cart | Blog |
|---|---|---|---|---|---|---|
| Ember — Restaurant | builder | universal | grandeur | grandeur | grandeur | builder |

## Also affects live stores
When an owner publishes a Customize "custom home page" over a template that has its own home page, the home page becomes `builder` but product, cart and the other shared pages keep that template's `universal` look.

## Where each mismatch comes from
- Product: `app/store/[slug]/product/**` always wraps in `TemplateShell` (even for Builder templates).
- Cart: `app/store/[slug]/cart/**` uses `cart-inline` for Builder templates.
- Blog: `lib/storefront/blog-page.tsx` and `components/storefront/blog-views.tsx` always use `BuilderHeader`/`BuilderFooter`.
- Ember: `lib/storefront/chrome.ts` picks Grandeur by business category, not by template.
