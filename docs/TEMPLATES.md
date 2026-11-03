# BizNest templates: how they fit together

Last verified against the code: 2026-10-19. Replaces TEMPLATE_RESET.md, TEMPLATE_PRODUCTION_AUDIT.md,
SIGNATURE_TEMPLATE_REBUILD.md, IMPLEMENTATION_NOTES_SIGNATURE_TEMPLATES.md and DELETED_TEMPLATES.txt,
which described earlier states of the catalog.

## Catalog
49 registry entries (`lib/template-registry.ts`), 45 of them public in the gallery: 11 reference + 15 legacy/variant + 19 signature,
plus 4 compatibility entries (Grandeur, Veloura Hotel, TasteHouse, Example) kept only for stores already using them.
Run `lib/__tests__/template-consistency.test.ts` for the authoritative list; counts in older docs are out of date.

## Single sources of truth
| Question | Where |
|---|---|
| Template names, categories, supported business types | `lib/template-themes.ts` (`LEGACY_CATEGORY_BY_NAME`, `LEGACY_TEMPLATE_NAMES`, `SIGNATURE_CATEGORY_BY_MODE`, `SIGNATURE_SUPPORTS_BY_MODE`) |
| Which component draws a template's homepage | `lib/storefront/resolve-renderer.ts` (`resolveHomeRenderer`), used by the live storefront AND `/template-preview` |
| Dedicated signature renderers (one entry each) | `lib/storefront/signature-renderers.ts` |
| Registry / compatibility / plan tier | `lib/template-registry.ts`, `lib/template-compatibility.ts`, `lib/actions/template.ts` |
| Seeded DB rows | `prisma/seed.ts` (derives from the maps above; Example is included, so seeding never deactivates it) |

`TemplateDefinition.renderer` is the journey family used by route guards (hotel / tastehouse / grandeur / example / builder).
`TemplateDefinition.home` is the homepage renderer kind from the resolver. They are different on purpose.

## Adding a template
1. Add its theme to `RESTORED_LEGACY_TEMPLATE_CATALOG` or `SIGNATURE_TEMPLATE_CATALOG`.
2. Add its category (and for signature: supported business types) to the maps above.
3. If it needs a dedicated homepage, add it in `resolve-renderer.ts` / `signature-renderers.ts`.
4. Run `vitest lib/__tests__/template-consistency.test.ts`; it checks runtime/preview agreement, categories, compatibility and claim copy.

## Compatibility rule
Niche never blocks a template. Any business can preview, select and create a store with any template (`setStoreTemplate`, `createStore`, the gallery and the setup wizard no longer reject or grey out by niche). `isTemplateCompatibleWithBusiness` is used only to rank "best fit" templates first and for the optional "Only show <niche> templates" filter. Plan tier is still enforced.

## Inner pages
About, Contact, FAQ, Policies, Services, Pricing, Portfolio and Reviews render through `UniversalSectionPage`. It is wrapped in `.bn-skin`,
whose `--u-*` variables (bg, ink, card, accent, dark, fonts, radius, button radius) come from the store's resolved template theme
(`lib/storefront/inner-skin.ts`, rules at the end of `app/globals.css`). So every template's inner pages carry its colours, fonts and corners.
A template whose home page hard-codes its look (Wanderly, Nestoria) has an entry in `HOME_MATCHED` there, which also sets its nav, CTA and footer shape.
Hotel, TasteHouse and Builder templates still have their own inner-page journeys.

## Shared helpers (do not re-define per template)
- `lib/utils/format-money.ts`: `formatMoney(amount, currency)` for every price shown to customers.
- `lib/utils/store-href.ts`: `storeHref(slug, path)` for store-relative links.
- `lib/default-images.ts`: `defaultPhoto(id)` for stock photos; self-host with `node scripts/fetch-default-images.mjs` and `NEXT_PUBLIC_DEFAULT_IMAGE_BASE_URL=/defaults`.

## Builder templates (11 signature templates)
They share one renderer (`components/storefront/builder-renderer.tsx`), so differences must come from theme data:
- `heroStyle`: `split` (text + image), `centered` (stacked) or `fullbleed` (text over full-width image, brand gradient if no image). Honoured since 2026-10-19.
- `sectionCopy`: per-niche eyebrow/heading for about, features, categories, testimonials, newsletter, contact (`SIGNATURE_SECTION_COPY` in `lib/template-themes.ts`). Sections without an entry fall back to the generic headings in `template-builder-config.ts`.
- `template-consistency.test.ts` fails if two builder templates end up with identical section headings, or if legacy templates regain hardcoded promo claims.
