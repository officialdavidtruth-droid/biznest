# BizNest Website Builder Audit

Scope: Customize screen (`/admin/customize`), builder config + actions, storefront renderer, Pages panel, template switching.
Method: read the code end to end, installed dependencies, ran the builder tests, classified all 44 registry templates by renderer, and regression-tested every template and industry preset against the tightened schema. No browser or live DB testing.

## Verdict
The save pipeline works (permission check, schema validation, revalidate). But "Publish visual website" does nothing for 24 of 44 templates, four of the six suggested Pages never show their content, and several builder sections show hard-coded placeholder text on live stores. Fixes for the clear-cut bugs are in the patch zip.

## Fixed in the patch
| # | Severity | Issue | Fix |
|---|---|---|---|
| 1 | High (security) | Button link, image URL and colour fields were only length-checked. `javascript:` links and CSS breakout strings were stored and rendered on live storefronts. | `lib/builder-safe.ts` validators in the schema, and the same helpers at render time in `builder-renderer.tsx`, `hero-variants.tsx`, `builder-subpages.tsx`, so old saved data is also neutralised. All 44 templates and all industry presets still pass the schema. |
| 2 | High | Newly created pages got a fake client id, so Publish/Unpublish and Delete failed with "Page not found" until reload. | `saveStorePage` now returns the real id and slug; the editor uses them. |
| 3 | Medium | Hero button default `#catalog` pointed at nothing on all 20 builder templates (their section ids are `catalog-2`, etc.). | Click handler scrolls to the first section of that type when the exact id is missing. |
| 4 | Medium | The hero could be deleted and moved on template-generated configs (id `hero-0`, guard checked `id === "hero"`). | Guard by section type. |
| 5 | Medium | Custom pages with slugs like `cart`, `search`, `rooms`, `product` saved fine but could never load (static routes win over `[pageSlug]`). | `saveStorePage` rejects those slugs with a clear message. |
| 6 | Low | "Use recommended homepage" ignored the store's sells-products/offers-services settings. | Passed through. |
| 7 | Low | Stale test `storefront-routes.test.ts` failed although the code was correct. | Test matches the current code. |
| 8 | Medium | The editor gave no sign when the chosen template ignores the builder. | Amber notice in the Customize menu with a link to change template. |

## Needs your decision (not changed)
1. **24 of 44 templates ignore the visual builder.** `resolveHomeRenderer` returns legacy (14), hotel (6), screenshot (3) or example (1) before the saved builder config is checked. Owners on Violet, Fabtex, Heenzy Sneaker, JuiceLife, Rivora, Fresh & Co., Premium Marketplace, HomeVista, etc. see "Website published" but nothing changes, and the live preview never updates. Options: convert those templates to builder-kind, or hide the builder entirely for them. The new notice only warns.
2. **Pages panel: About, Gallery, Blog, Contact save but never display.** `app/store/[slug]/{about,gallery,blog,contact}` are static routes that never read `StorePage`. Only FAQ, Policies and non-colliding custom slugs render saved content. Either make those routes read `StorePage`, or drop the four from `SUGGESTED_PAGE_SLUGS`.
3. **Hard-coded placeholder content on live stores:**
   - Features section: four fixed titles and "This section highlights a customer benefit configured by the business." Not editable.
   - FAQ section: fixed generic questions, not editable.
   - Map section: always shows "Add your location in Store Settings", never a map.
   - Gallery section: shows product images, not uploaded gallery images.
4. **Edit-mode detection** is `window.self !== window.top`, so a storefront embedded in any other site's iframe has its links disabled.
5. **Cleanup:** the legacy `order`/`hidden` state and `saveSections` in `customizer-client.tsx` are now unreachable. `saveBuilderConfig` also writes builder ids into the legacy `order`/`hidden` keys. `ImageField` nests a `<label>` inside a `<label>`. No unsaved-changes warning when leaving Customize.

## Verified working
- `saveBuilderConfig` / `updateStoreSeo` / page actions all gate on the `settings` permission and scope queries to the store.
- Zod schema rejects malformed configs; builder-config tests pass.
- Switching template drops the old builder draft and palette overrides (intended, documented in code).
- `/admin/builder` and `/admin/website-editor` redirect to Customize.
- Preview postMessage channel checks origin and source on both sides.
- Item links use `/store/<slug>/<kind>/<id>`, matching the existing routes.

## Test results and limits
- Passing: builder-config (3), builder-safe (4 new), storefront-routes (2), pricing, format-money. 23 tests pass.
- Not runnable here: `prisma generate` is blocked (no access to binaries.prisma.sh). That causes all 762 `tsc` errors (identical count before and after my changes, none in touched files) and two suites that fail to load (`business-experience`, `slug`; two more template tests also need the client). Run `npm run typecheck && npm test` locally or on Vercel to confirm.
