# BizNest Website Builder Audit (second pass)

Destination: `BUILDER-AUDIT.md` (repo root, replaces the existing file)

Scope: Customize screen, builder schema and save actions, AI Store Builder, Pages, template switching, storefront renderer.
Method: read the code, ran the six builder test suites (26 tests pass), and probed the schema and safety helpers directly.
Not done: `prisma generate` / `tsc`, browser testing, live DB testing.

## Verdict
The core is sound: saves are permission-checked and store-scoped, link/image/colour fields are validated on save and on render, and the shared JSON column is written under a row lock. The weak spot is the **AI Store Builder apply path**, which skips almost every guard the manual builder has. Beyond that, the schema allows configs that blank a live homepage, and new stores show empty placeholders to customers.

## Re-verified from the previous audit
- `javascript:`, `//host`, `data:` links and CSS breakout colours are rejected (probed).
- Unsaved-changes warning and local draft restore now exist in `customizer-client.tsx`, so old open item 5 is partly stale.
- Hero guard, `#catalog` scroll fallback, reserved page slugs and page-id fix are in place.

## Status after fixes
You asked me to skip the AI Store Builder, so findings 1 to 4 and 14 are left open and untouched.

| # | Status | What changed |
|---|---|---|
| 5 | Fixed | Publishing now requires unique section ids, a Hero, and at least one visible section (`builderConfigSaveSchema`). Reading stays lenient, and old data with repeated ids is renamed on read so those stores keep working. |
| 6 | Fixed | Visitors no longer see the empty reviews box, "0+" or "New" stats, or an empty contact block. The owner still sees a labelled placeholder in the Customize preview. |
| 7 | Fixed | `saveBuilderConfig` takes the layout the editor started from and refuses to overwrite a newer one; the editor asks before replacing it. The legacy unlocked `updateSectionOverrides` is deleted. |
| 8 | Fixed | Owners can add their own numbers (Stats) and testimonials. Real reviews show first; own testimonials follow, capped at 6 cards. |
| 9 | Fixed | Contact shows WhatsApp (from the store's WhatsApp number, Nigerian local numbers handled), phone and email. |
| 10 | Fixed | Saving requires https (or a site path); old http images still render. Parentheses in image URLs now work. |
| 11 | Fixed | Page title max 120, body max 20,000 characters. The reserved-slug list moved to `pages-constants.ts`; the existing test fails if a new route folder is not listed. |
| 12 | Fixed | Edit mode now requires the page to be framed by the same site, so stores embedded elsewhere keep working links. |
| 13 | Fixed | Preview messages are ignored outside the Customize preview and validated before use. |
| 15 | Fixed | Fonts always get a fallback stack. |
| 16 | Fixed | Deleted `components/dashboard/section-editor.tsx` and `lib/actions/sections.ts` (nothing imported them). |
| 17 | Partly | New tests cover publish rules, old-data reading, helpers and the WhatsApp link. Page-save and preview-message paths are still not unit tested (they need a database / browser). |
| new | Fixed | The Stats section counted only the 8 featured items, so it could never show more than "8+ products". It now uses the real total. |

Checks run: all builder and utility suites pass (55 tests); all 44 templates and the industry presets pass the new publish rules; no TypeScript errors in the touched files. `prisma generate` is blocked here, so run `npm run typecheck && npm test` locally.

## Template homepages: edit the real design
Templates that draw their own homepage (14 legacy, 5 hotel, 1 screenshot; 20 in total) used to be previewed as a builder draft, so you could not see or edit the real design. Now:
- Customize opens on the **real template** (`?preview=template`). Hero and story text, images and pages save live and show in the preview.
- A new **Colours** panel sets the accent and page background (`lib/actions/theme.ts`, hex only, with "use the template's own colours" to undo).
- Hotel templates also link to Rooms, dining & amenities.
- The visual builder is now opt-in for these templates ("Use the visual builder" and "Back to my real template"). Publishing it still replaces the template homepage, and Restore still undoes that.
- Not editable from here: layout and section order of these templates. That needs the builder.

## Findings (original list)

### High
| # | Issue | Where | Evidence |
|---|---|---|---|
| 1 | **No plan gate on apply.** `generateAiStoreDraft` checks `features.aiStoreBuilder`; `applyAiStoreDraft` does not. Any store owner can call the action directly and write a hand-made draft. | `lib/actions/ai-store-builder.ts` | Code read |
| 2 | **Apply trusts the client's draft.** The draft is never re-parsed with `storeDraftSchema` or `builderConfigSchema`. `themeColors`, hero and story text and the `builder` object are written as received. The AI schema itself is loose (`z.string()` with no max, no hex check). | same | Code read |
| 3 | **Silent fallback after apply.** If any heading exceeds 180 chars or any body 4000, the saved config fails `readBuilderConfig`, `getSavedBuilder` returns null, and the store quietly shows the template instead. The owner is told it applied. | `saved-builder.ts`, `ai-store-builder.ts` | Code read |
| 4 | **Apply overwrites all of `sectionOverrides`** with a fresh object and bypasses `updateSectionOverridesJson`. Other keys (example content, template content, anything added later) are wiped and concurrent saves can be lost. It is also owner-only, while every other builder action uses the `settings` permission. | same | Code read |

### Medium
| # | Issue | Where | Evidence |
|---|---|---|---|
| 5 | **Schema accepts broken layouts:** duplicate section ids, no hero, and every section hidden. Duplicate ids break section selection, anchors and React keys. All-hidden publishes a blank homepage. The hero guard exists only in the UI. | `lib/builder-config.ts` | Probed: all three accepted |
| 6 | **Empty placeholders on live stores.** Default config has testimonials visible, so customers see a dashed box reading "Customer reviews will appear here when you receive them." Stats show "0+ Published products" and "New" twice. Show these only in edit mode, or hide when empty. | `builder-renderer.tsx` (testimonials, stats, `EmptyState`) | Code read |
| 7 | **Last write wins.** The stale-draft prompt is client-side only; `saveBuilderConfig` takes no base version. Two staff publishing at once overwrite each other. The legacy `updateSectionOverrides` also skips the row lock. | `builder.ts`, `sections.ts` | Code read |
| 8 | **No way to add your own social proof.** Testimonials come only from reviews; stats are not editable. A new merchant has no proof section at all, which is the segment that most needs it. | renderer | Code read |
| 9 | **Contact section is thin.** Email and phone tiles only. No WhatsApp link, no form, and it renders an empty block if neither is set. | renderer | Code read |
| 10 | **Image URL rule is too loose and too strict.** Allows plain `http:` (mixed content on an https store) and any host, but rejects valid URLs containing parentheses. Prefer https plus Cloudinary or your own host. | `builder-safe.ts` | Probed |
| 11 | **Pages have no length limits.** `saveStorePage` caps neither title nor body. The reserved-slug list is hand-maintained and will drift as routes are added. | `pages.ts` | Code read |

### Low
| # | Issue | Where |
|---|---|---|
| 12 | Edit mode is `window.self !== window.top`, so embedding a store in another site disables its links (still open from last audit). | `builder-renderer.tsx` |
| 13 | The live storefront also listens for preview messages. When not framed, `window.parent === window`, so it accepts its own messages. The payload is cast to `BuilderConfig` without validation. Only act on messages when `isEditMode`, and run `readBuilderConfig`. | `builder-renderer.tsx` |
| 14 | AI call has no timeout, a hard-coded model id, and `max_tokens: 2000` for a large JSON object, so truncation shows up as "Couldn't parse". No retry. | `lib/ai/store-builder.ts` |
| 15 | Fonts are free text in the schema, but the layout loads a fixed Google Fonts list, so anything else silently falls back. Customize has no font control. | `layout.tsx`, schema |
| 16 | Legacy `updateSectionOverrides` (7 section types vs 14) is dead code but still an exported server action. | `lib/actions/sections.ts` |
| 17 | No tests for `applyAiStoreDraft`, `saveStorePage`, or the preview message handler. | `lib/**/__tests__` |

## Recommended fix order
1. Apply path (#1 to #4): plan gate, re-validate with `storeDraftSchema` and `builderConfigSchema` (truncate to limits before saving), write through `updateSectionOverridesJson`, use the `settings` permission, and return an error if the saved config would not read back.
2. Schema refinements (#5): unique ids, at least one visible section, require a hero.
3. Hide empty testimonials and stats on the live storefront (#6), then add owner-written testimonials and editable stats (#8).
4. Base-version check on `saveBuilderConfig` (#7).
5. Everything else.

## Where the audience principle plugs in
The builder has no audience layer yet. The natural hooks are `defaultBuilderConfig` / `buildIndustryHomepage` (section presets and default copy), the `SYSTEM_PROMPT` in `lib/ai/store-builder.ts` (audience-aware copy), and a new onboarding field. Fix #3 and #8 first, since proof and honest empty states are what that copy depends on.
