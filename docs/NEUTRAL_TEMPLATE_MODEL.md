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

## Only the owner's words reach visitors
The Builder no longer writes content on a merchant's behalf:
- Features ("Why choose us") and FAQ show only entries the owner wrote (or the store's own FAQ). The invented defaults ("Every item is checked before it reaches you", "Experienced team"...) are gone from the live site. They remain only as starter text inside the editor.
- About, text and hero body show only the owner's description. Filler such as "Tell customers what makes this business different." or the generic business descriptions is recognised by `ownText()` (`lib/builder-defaults.ts`) and never shown, including in layouts saved earlier.
- A section with nothing to show is left out on the live site; the editor still shows it.


## Update (v15)
- **Bloom** now renders through the Builder (own header/footer/card/hero identity in `NAMED_TEMPLATE_IDENTITY`). Its fixed "Skin Care / Makeup / Hair Care" menu was removed (`home-nav.ts`); the menu now comes from the owner's categories and menu like every other template.
- **Editable section headings:** owners can rename the heading / small label of Categories, Products, About, Reviews, Newsletter and Contact from Customize → Arrange sections → "Section headings", without publishing a custom layout. Stored in `sectionOverrides.sectionHeadings`, applied in `storefront-runtime.tsx` (`lib/storefront/section-headings.ts`).
- **Still own-home:** 6 hotels (Veloura, Aspire, Larita, Skyview, Maison, Grand), Grandeur, TasteHouse, Example. They carry their own booking / ordering / reservation journeys, so converting them means rebuilding those journeys as Builder blocks first.


## Update (v16)
- **Grandeur, TasteHouse and Example** now render through the Builder (registry `renderer: "builder"`, own look in `NAMED_TEMPLATE_IDENTITY`). Their template-name branches were removed from cart, checkout, catalog, orders, order tracking, confirmation, account layout, `system-page-support.ts` and `chrome.ts`. Orders now run through the standard cart/checkout like every other template.
- About, Contact and order confirmation only draw the restaurant skin for a template that is itself a restaurant-skin template (`getGrandeurRestaurantData(slug, { skinOnly: true })`), so a restaurant owner on a Builder template keeps one header and footer. Reservations, events, gallery and payment remain restaurant-business features.
- **Display names:** `lib/template-display-name.ts` drops niche words in galleries/previews ("Ember", "Muse", "Wanderly"). Stored names are unchanged so existing stores keep their template.
- **Hotels (Veloura, Aspire, Larita, Skyview, Maison, Grand)** still use the hotel journey: rooms, booking and PMS are a real feature, not template wording, and their text comes from the hotel admin. Making rooms/booking a Builder block is the remaining design task.
- Left in place (now unused by routing, safe to delete later): TasteHouse/Example/Grandeur home and journey components.
