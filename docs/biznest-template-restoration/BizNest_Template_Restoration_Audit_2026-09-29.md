# BizNest Template Restoration Audit

Date: 2026-09-29 (WAT)
Scope: `biznest-main (23)`, `biznest-main (25)`, and the restored 23-template archive.

## Executive finding

The restoration is **not yet complete**. The 23-template catalog exists in the theme definitions and database seed, but the production storefront does not consistently render those selected templates on the homepage. Several theme variants remain dormant, the registry exposes more templates than the seeded public catalog, and the preview route is a generic theme facsimile rather than the production storefront renderer.

## 1. Archive comparison

- `biznest-main (23)` contains 824 files.
- `biznest-main (25)` contains 826 files.
- There are **0 files present only in 23**.
- There are **2 files present only in 25**: `MARKETING_V2_BUILD.md` and `components/dashboard/marketing-command-center.tsx`.
- Only two existing files changed between 23 and 25: `app/marketing/page.tsx` and `app/store/marketing/page.tsx`.
- Therefore, the later archive did **not** restore or remove the legacy template implementation files; the template reset state was already present.

## 2. Intended public catalog: 23

### Legacy / industry designs (9)
1. Fresh & Co.
2. Heenzy Sneaker Co.
3. Nova Studio — Noir
4. Violet
5. Premium Marketplace
6. HomeVista
7. rRW Premium Rental
8. Marketplace Hub
9. Arcova Architecture

### Signature Collection (14)
10. Electra — Smart Commerce
11. Atelier — Modern Fashion
12. Kinetic — Sneaker Drop
13. Bloom — Beauty Boutique
14. Haven — Home & Furniture
15. Harvest — Grocery Market
16. Maison — Hotel & Stay
17. Grand — Hotel & Hospitality
18. Ember — Restaurant
19. Muse — Salon & Beauty
20. Frame — Photography Studio
21. North — Creative Agency
22. Pure — Cleaning Services
23. Forge — Construction

The restored seed does activate these 23 rows.

## 3. Registry vs seed mismatch

`lib/template-registry.ts` contains **27 definitions**:

- 4 backward-compatible legacy definitions: Grandeur, Veloura Hotel, TasteHouse, Example Electronics.
- 9 restored legacy/industry definitions.
- 14 Signature definitions.

The seed activates only the 23-template public catalog. This is intentional according to `RESTORED_TEMPLATES.md`; the four compatibility definitions are retained in code for existing stores.

However, the admin template page uses the registry and can synthesize fallback options for definitions that are not present in the database. That means the admin UI can expose definitions that are not part of the seeded public catalog.

## 4. Dormant theme variants

`lib/template-themes.ts` contains additional template variants that are not in the 23-template seed and are not registered as selectable public templates:

- Heenzy — Boutique Rose
- Nova Studio — Ivory Minimal
- Violet — Sunset
- Rivora Fresh
- JuiceLife
- Fabtex

These are not missing source definitions; they are **dormant/unwired**.

## 5. CRITICAL: homepage renderer does not apply selected template theme

`components/storefront/storefront-runtime.tsx` routes the 9 restored legacy templates and all Signature templates to `BuilderStorefront` because their registry renderer is `builder`.

When no saved builder configuration exists, it calls:

`defaultBuilderConfig(store.name, store.business?.description, store.bannerUrl, ...)`

It does **not** convert the selected `StoreTemplate.config` / `TemplateTheme` into a `BuilderConfig`.

Result: selecting a restored template can change the database template selection and theme-aware inner pages, but the live homepage can fall back to the generic industry builder design rather than the selected template's visual system.

This is the largest functional restoration gap.

## 6. Template theme resolution exists, but is only used in other routes

`resolveStoreTheme(...)` correctly knows how to resolve the legacy template names and their theme tokens.

It is used by product, service, category, search, section and customization-related routes.

It is **not** used by the builder homepage runtime to construct the live homepage configuration.

This creates a split experience: inner pages can reflect a template while the homepage does not necessarily use it.

## 7. CRITICAL: Signature templates are not broadly compatible

All Signature registry definitions use:

`supports: ["Other"]`

The compatibility function treats `Other` as a literal canonical business type, not as a wildcard. Therefore a Signature template can be considered compatible when the merchant's business type is actually `Other`, but not generally for a specific type such as Fashion, Beauty, Restaurant, Hotel, etc.

Because the gallery filters by compatibility, Signature templates can disappear for normal merchants.

This needs to be changed to explicit supported business categories or an intentional wildcard rule.

## 8. Template preview is not a true live storefront preview

The restored `app/template-preview/[name]/page.tsx` reads the template theme and renders a generic preview containing:

- navigation
- hero
- generic featured content cards
- a closing section

It does not render the actual production `BuilderStorefront` configuration or the specialized production storefront flow.

Therefore copy such as “fully working” / “real live demo” is stronger than what this route currently provides.

The older Library copy of `template-preview-page.tsx` contains a much richer preview architecture referencing specialized renderers, but those specialized renderer files are not present in the restored archive.

## 9. Exact old specialized template components are not present

The reset documentation explicitly records removal of:

- `components/storefront/templates/*`
- signature-specific customer journey components
- several template-specific cart/checkout clients
- old hotel/room routes
- several specialized template cart/checkout clients
- supporting restaurant/template components

Neither `biznest-main (23)` nor `biznest-main (25)` contains those removed specialized template component files.

Therefore the current restoration is a **theme/config restoration**, not an exact restoration of every former template component and customer journey.

If the goal is exact historical UI/interaction parity, those component implementations still need to be recovered from an earlier source/commit/archive.

## 10. Seed behavior is otherwise protective

The restored seed:

- upserts the 23 public templates,
- marks them active,
- updates category/tier/config,
- deactivates templates outside the public catalog,
- does not delete old StoreTemplate rows or null existing merchant template references.

This is the correct general approach for protecting existing store references.

## 11. Template selection action

`setStoreTemplate()` correctly:

- checks store permission,
- resolves the registry definition,
- creates the DB template row when needed,
- checks active state,
- checks business compatibility,
- checks plan tier,
- updates the store's template ID,
- revalidates the relevant pages.

But it does not generate a builder configuration from the selected theme. That is the companion defect to the homepage renderer issue.

## 12. Compatibility and discovery

The registry supports explicit business categories for several legacy templates, but some restored designs use `Other` as a support category. Because the compatibility function does not treat `Other` as a wildcard, those designs may be filtered out unexpectedly.

The gallery also computes a recommendation score, but that score is only used for ordering; it does not repair compatibility mismatches.

## 13. Stale / cleanup findings

- `getTemplateTheme()` in `lib/template-themes.ts` returns `FRESH_THEME` unconditionally. It appears stale because `resolveStoreTheme()` is the real name-aware resolver.
- `generateNicheVariations()` still documents an older two-template model. This is stale relative to the restored 23-template catalog.
- The registry contains compatibility templates that are deliberately outside the public 23-template seed. This is acceptable if clearly treated as backward compatibility, but the admin fallback behavior should be deliberate.
- Unseeded variants should either be explicitly documented as dormant or removed from the active theme module until they are ready.

## 14. Restoration status matrix

| Area | Status | Finding |
|---|---|---|
| 23 template names | RESTORED | All 23 intended names are represented in the seed/catalog documentation. |
| Theme definitions | RESTORED | Legacy themes and 14 Signature themes exist. |
| Database seed | RESTORED | 23 public rows are upserted and old rows are hidden, not deleted. |
| Existing merchant references | PROTECTED | Seed does not delete/null old template references. |
| Admin selection registry | PARTIAL | 27 definitions exist; 23 are public, 4 are compatibility-only. |
| Homepage visual rendering | BROKEN/PARTIAL | Builder homepage does not consume selected TemplateTheme. |
| Inner-page theme resolution | PRESENT | `resolveStoreTheme()` is wired into multiple inner routes. |
| Signature compatibility | BROKEN/PARTIAL | `supports: ["Other"]` blocks many real business types. |
| Template preview route | PARTIAL | Generic theme preview, not actual production storefront. |
| Exact historical specialized renderers | MISSING | Removed `components/storefront/templates/*` are not in the current archives. |
| Dormant variants | UNWIRED | 6 additional theme variants exist but are not public/seeded. |
| AI Store Builder | PRESERVED/SEPARATE | Restoration archive intentionally excludes changing it. |

## 15. Recommended repair order

### P0 — Make template selection actually change the homepage
Create a deterministic `TemplateTheme -> BuilderConfig` adapter and use it in `renderStorefront()` whenever the selected renderer is `builder` and there is no merchant-saved builder config.

The adapter should map at minimum:

- bg -> background
- card -> surface
- ink -> text
- muted -> muted
- accent -> accent/primary
- font -> font
- headlineFont -> headingFont
- radius -> radius
- headline/sub/eyebrow/cta -> hero section settings
- sections -> builder section visibility/order
- heroStyle/layout/density -> section structure and spacing

### P0 — Fix Signature compatibility
Either:

1. give every Signature template explicit supported business categories, or
2. introduce an explicit wildcard capability rather than abusing the `Other` category.

### P1 — Make the preview match the actual renderer
Use the same builder/template rendering path for `/template-preview/[name]`, with preview data injected into the renderer. The preview should be representative of the storefront a merchant will actually receive.

### P1 — Make the registry/catalog contract explicit
Choose one source of truth for the public catalog. The clean model is:

- `PUBLIC_TEMPLATE_REGISTRY` = the 23 public templates,
- `LEGACY_COMPATIBILITY_TEMPLATES` = the 4 backward-compatible definitions,
- dormant variants remain outside both until intentionally released.

### P1 — Decide what to do with the six dormant variants
Either wire them fully or mark them explicitly as unreleased. Do not leave them looking like partially restored templates.

### P2 — Recover exact historical specialized components if required
If “restore” means exact historical UI/interaction parity rather than the current theme-driven architecture, locate an earlier GitHub commit/ZIP containing the removed `components/storefront/templates/*` and template-specific cart/checkout implementations.

## Final verdict

**The 23-template catalog itself is restored, but the restoration is not production-complete.** The highest-priority defect is that the selected restored template is not reliably driving the live homepage renderer. The next highest is Signature compatibility. After those are fixed, the preview route and registry/public-catalog separation should be hardened.
