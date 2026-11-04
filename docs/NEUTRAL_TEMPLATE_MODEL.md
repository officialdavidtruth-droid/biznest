# Neutral template model (Horizon)

A template is a **look**. Everything it says comes from the merchant's business.

## The rule
1. No niche words in the template: no "Destinations", "Listings", "Menu", "Rooms" and so on.
2. Headings, button labels and the choice of sections come from `lib/business-experience.ts` (shop, service or mixed).
3. Header links come from the owner's Menus; categories come from the owner's Categories (empty ones included).
4. A section with nothing to show is left out on the live site (the editor still shows it).
5. One header and footer on every page (`StorefrontShell`).
6. A neutral template is selectable by every business type (`supports: ["*"]`).

## How it is wired
- `lib/reference-theme-data.ts`: the `Horizon` entry has `neutral: true`.
- `lib/template-builder-config.ts`: when `theme.neutral` and the business is known, section wording is taken from `buildIndustryHomepage()`; the look stays the template's.
- `components/storefront/builder-renderer.tsx`: `categoryList` (owner's real categories) feeds the categories section.
- `lib/__tests__/neutral-template.test.ts`: add a template's name to `NEUTRAL` once it follows the rule; the test fails if niche wording appears.

## Converting another template
Set `neutral: true`, drop its `sectionCopy`, `cta` and niche `catalogLabel`, and add it to the test's `NEUTRAL` list.
Templates with their own hard-coded home (Wanderly, Nestoria, hotel and others) are converted last or retired.

## Rollout status
- **Horizon** is the model (suggested to every business type).
- **Every template drawn by the Builder** (about 25) is neutral at render time: `storefront-runtime.tsx` and the template preview pass `neutral: true`, so wording comes from the business and the template keeps only its look (colours, header, footer, cards, hero).
- Their `supports` list is unchanged: it only decides which templates the gallery *suggests* for a business. Any template can already be picked with "Show all" in the gallery.
- **Wanderly Travel and Nestoria Real Estate** now render through the Builder (their old home components are deleted). Their colours, header, footer, cards and hero style are kept; their wording comes from the business.
- Open group departures and the enquiry/booking form (BizNest Travel) are drawn by the Builder after the catalog (`components/storefront/builder-departures.tsx`) for ANY template, when the agency has open departures.
- **The 12 legacy templates** (Fresh & Co., Heenzy Sneaker Co., Nova Studio Noir, Violet, Premium Marketplace, HomeVista, rRW Premium Rental, Marketplace Hub, Arcova Architecture, Rivora Fresh, JuiceLife, Fabtex) now render through the Builder. The legacy renderer (`legacy-template-renderer.tsx`) and `templates/heenzy-home.tsx` are deleted, and the `"legacy"` home kind no longer exists.
- Not converted yet: the hotel templates (Aspire, Larita, Skyview, Maison, Grand, Veloura), Example, TasteHouse and Grandeur. They have their own journeys (room booking, menus, reservations).

## Empty sections
Catalog, gallery, map, stats, testimonials and categories are left out on the live site when they have nothing to show. The editor still shows them.

## Default header menu
Until the owner saves a menu, the Builder header shows Home, Shop/Services, up to three of the owner's categories, About, Contact.
