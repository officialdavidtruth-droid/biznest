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
- Not converted yet: templates with a hard-coded home page (Wanderly, Nestoria, the hotel templates, Example, TasteHouse, Grandeur and the legacy homes).

## Empty sections
Catalog, gallery, map, stats, testimonials and categories are left out on the live site when they have nothing to show. The editor still shows them.

## Default header menu
Until the owner saves a menu, the Builder header shows Home, Shop/Services, up to three of the owner's categories, About, Contact.
