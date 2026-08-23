# BizNest — Builds 3, 4 & 5

## Build 3 — Separate commerce/service journeys
- Added `lib/business-experience.ts` with commerce, service and hybrid business journeys.
- Service businesses now get service-oriented homepage structure and CTAs instead of being treated like ordinary product stores.
- Builder storefront cards identify service actions separately from product actions.
- Hotel, restaurant, portfolio/booking and general service presets use different section priorities.

## Build 4 — Smarter homepage builder
- Industry-aware homepage presets are generated automatically from the business category.
- Customize Website now shows the recommended journey and a one-click "Use recommended homepage" action.
- AI Store Builder now generates an ordered homepage plan and applies it to the visual builder, not only copy/SEO fields.
- Existing manually saved builder configurations remain untouched.

## Build 5 — Better template selection
- Template gallery now supports All / Shopping / Services & booking modes.
- Templates are scored so the best-fit options appear first for the merchant's business type.
- Added a live preview modal so merchants can click through the real storefront without leaving the template picker.
- The template picker now clearly communicates the current business category and recommended journey.

## Verification
- Full dependency installation (`npm ci`) timed out in the build environment, so a complete production Next.js build could not be executed here.
- Source-level brace/parenthesis checks were run on all modified files.
