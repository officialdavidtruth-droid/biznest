 # BizNest

A SaaS e-commerce + services marketplace + website builder (Shopify/Fiverr-style), built with Next.js 15, Prisma, PostgreSQL, and Auth.js.

## What's in this build (Phase 1: Foundation)

This is the foundation layer everything else plugs into — built for correctness over
breadth, since a platform this size only works if the base is solid.

- **Full data model** (`prisma/schema.prisma`) covering every subsystem in the spec:
  auth, KYC/business verification + guarantors, stores, website-builder pages,
  product/service catalog + categories, inventory, bookings, orders, escrow-style
  order status, disputes, coupons, reviews, messaging, notifications,
  subscriptions/commissions, audit logs, platform settings.
- **Auth** — email/password + Google OAuth via Auth.js, role-aware sessions
  (Customer / Store Owner / Platform Admin / Support Moderator), email verification
  token flow, password-hashing with bcrypt.
- **Business verification (KYC)** — one form, two conditional paths exactly as
  specified: registered business (certificate upload) vs. unregistered
  (government ID + selfie + exactly 2 guarantors, each with their own ID). Server-side
  Zod validation via a discriminated union so the two paths can't be mixed or bypassed.
- **Fraud policy acceptance** — exact policy text from the spec, explicit
  checkbox + timestamped acceptance stored on the `Business` record, required
  before store creation regardless of verification status.
- **Store creation** — gated server-side on `verificationStatus === "APPROVED"`
  AND fraud policy acceptance (never trust the client for this). Generates a
  unique slug, public storefront URL, and admin dashboard URL automatically,
  seeds the 10 website-builder pages (Home, About, Products, Services, Gallery,
  Testimonials, FAQ, Blog, Contact, Policies), and promotes the user to
  `STORE_OWNER`.
- **Store admin dashboard shell** — full sidebar nav matching the spec (Dashboard,
  Orders, Products, Services, Customers, Inventory, Coupons, Payments, Analytics,
  Reviews, Marketing, Messages, Website Builder, Settings, Verification Status,
  Subscription, Support), with an ownership check in the layout and a working
  overview page pulling real counts from the DB.
- **Public storefront page** — renders published products/services for a store.
- **File uploads** — Cloudinary-backed `/api/upload` route (auth-gated, type/size
  validated), reused by KYC docs, guarantor IDs, and later product images.
- **Middleware** — protects onboarding, dashboard, and admin routes; restricts
  `/admin/**` to platform staff roles.
- **Seed script** — populates the full product + service category lists and the
  25 website-builder template placeholders from the spec, plus 4 subscription tiers.

## Getting started

You'll need Node access and a Postgres database (this environment has no network
access, so run these steps on your own machine or in Claude Code):

```bash
npm install
cp .env.example .env   # fill in DATABASE_URL, AUTH_SECRET, Cloudinary, Resend, Google OAuth
npx prisma migrate dev --name init
npm run db:seed
npm run dev
```

Generate `AUTH_SECRET` with `npx auth secret`. For Paystack/Flutterwave you only
need platform-level keys for now — the "sellers connect their own account" OAuth
flow is phase 3.

---

## Fixes applied (this pass)

**Root cause of the site-wide 404s:** `components/dashboard/sidebar.tsx` links to
17 admin routes, but only 5 existed as real pages. Every link to Services,
Customers, Inventory, Coupons, Payments, Analytics, Reviews, Marketing, Messages,
Settings, Verification, Subscription, and Support 404'd because the files simply
didn't exist. All 12 are now built under `app/store/[slug]/admin/*/page.tsx`,
querying your actual Prisma models (no placeholders):

- **Services / Customers / Inventory / Reviews** — real list views against `Service`, derived-from-`Order` customer rollups, `InventoryItem`, and `Review`.
- **Coupons** — list + working create form (`lib/actions/coupon.ts`, new file).
- **Payments** — Paystack/Flutterwave subaccount connection status + gross sales and commission totals.
- **Analytics** — 30-day revenue bar chart and headline stats, computed from `Order`, no charting library needed.
- **Marketing** — surfaces coupons + social links as the current toolkit, honest about what's not built yet (email campaigns).
- **Messages** — lists `Conversation`/`Message` rows tied to orders.
- **Settings** — edit store name, contact info, theme colors, and social links (`updateStoreSettings` action added to `lib/actions/store.ts`).
- **Verification** — shows `Business.verificationStatus`, rejection reason if any, and guarantors.
- **Subscription** — current plan vs. available `Subscription` tiers.
- **Support** — contact channel (ticketing intentionally not faked).

**Root cause of "no template for the user website":** `app/store/[slug]/page.tsx`
never read `store.template` at all — every store rendered as the same unstyled
`<div>` grid, and `prisma/seed.ts` backed that up: all 25 seeded templates shared
one identical placeholder config. Fixed with:

- `lib/template-themes.ts` (new) — real, distinct palette/typography/hero copy for
  every major category (Restaurant, Fashion, Videography, Law Firm, Hospital,
  Real Estate, etc.), plus a deterministic fallback so any uncurated category still
  renders a stable, distinct look instead of one generic default. Store-level
  overrides from Settings (`themeColors`, `fontFamily`) win over the template
  default — same relationship as a Shopify theme + merchant customization.
- `app/store/[slug]/page.tsx` rewritten — sticky header with logo/verified badge,
  themed hero, WooCommerce-style product grid (price, compare-at price, digital/
  rental badges, add-to-cart wired to your existing cart context), services grid,
  footer with social links.

**Known follow-up:** `AddToCartButton` still uses a hardcoded CSS variable
(`--bn-marigold`) instead of the per-store accent color — cosmetic only, doesn't
block anything, but worth wiring up if you want the button to match each store's
theme exactly.

## Fixes applied (round 2 — template gallery + dashboard UI)

**Root cause of "no templates showing":** not a bug in the gallery component —
`prisma/schema.prisma`'s `StoreTemplate` table was simply empty on your
deployment. The `build` script ran `prisma db push` (creates tables) but never
ran the seed script, so every fresh deploy ships with zero templates and the
gallery correctly (if confusingly) reports "no templates match." Fixed:

- `package.json` — `build` now runs `tsx prisma/seed.ts` after `db push`, before
  `next build`. The seed uses `upsert`/`skipDuplicates` throughout, so it's safe
  to run on every deploy — it won't duplicate or wipe existing data.
- If you're not redeploying right away: run `npm run db:seed` once against your
  current database and the gallery will populate immediately.

**UI upgrade**, scoped to what actually renders sitewide so it isn't just one
screen:

- `components/dashboard/template-gallery.tsx` — rebuilt. Each card now renders
  a real mini-preview of that template's theme (from `lib/template-themes.ts`:
  actual background, accent, headline, CTA), not a flat gradient block. Added
  category filter chips, a live "X of Y templates" count, and two distinct
  empty states — one for "the catalog is genuinely empty" (tells you to seed)
  and one for "your search matched nothing" (offers to clear filters). These
  were previously indistinguishable, which is exactly what you ran into.
- `components/dashboard/sidebar.tsx` — rebuilt with grouped sections (Overview
  / Sell / Grow / Store / Account) instead of one flat 17-item list, a left
  accent bar + tinted background on the active item, and a store-initial badge
  at the top. Same aubergine/marigold/jade palette you already had — this is
  a structure and polish pass, not a re-theme.
- `app/store/[slug]/admin/layout.tsx` — content area now has a max-width and
  consistent page padding instead of every page managing its own spacing.
- `app/globals.css` — added a shared `.bn-card` elevation style so dashboard
  surfaces can converge on one shadow/radius language over time.

## Fixes applied (round 3 — 23 niche templates, real section rendering, supa admin redirect)

**Supa admin redirect bug — found and fixed.** Not a permissions problem on
your end. `lib/auth.ts` uses JWT session strategy, and the `jwt` callback only
wrote `token.role` when a fresh `user` object was present — i.e. only at
sign-in. After you called `/api/promote-admin` to become `PLATFORM_ADMIN`, the
database updated but your *existing session cookie* still carried your old
role, so `app/supaadmin/layout.tsx`'s role check kept failing and redirected
you to `/`. Fixed: the `jwt` callback now re-checks your role from the
database on every request, so a promotion (or a ban) takes effect immediately
without needing to log out and back in. Sign out and back in once to pick up
a clean token right away, or just wait — your very next request resolves it.

**23 full niche templates**, replacing the old 26-template placeholder set
(all of which shared one identical `{sections:["home","about","gallery","contact"]}`
config, which is why every template looked the same regardless of category):

- `lib/template-themes.ts` — rewritten around a `TemplateTheme` type carrying
  real per-niche identity: palette, type, a hero *style* (`centered` /
  `split` / `fullbleed`), which homepage sections appear and in what order,
  and niche-correct labeling (a hotel shows "Rooms", a law firm shows
  "Practice Areas", a videographer shows "Showreel" — not a generic
  "Products").
- `prisma/seed.ts` — seeds exactly these 23 templates with their section
  config stored in the DB (`StoreTemplate.config`), and **deactivates** any
  leftover templates from the old 26-name set rather than deleting them (a
  store could already reference one — deactivating removes it from the
  gallery without breaking an existing store). Run `npm run db:seed` to apply.
- `app/store/[slug]/page.tsx` — rewritten to render per-section:
  - **Hero** — one of three real layouts (full-bleed banner, split image/text,
    or centered), not just recolored copy.
  - **Catalog** — relabeled per niche; product/service cards unchanged from round 2.
  - **About** — pulled from `Business.description` (real onboarding data).
  - **Testimonials** — real `Review` rows, 4★+ with a comment, not fabricated.
  - **Contact** — WhatsApp / call / email actions built from the store's own contact fields.
  A section with no backing data simply doesn't render — no placeholder
  "Lorem ipsum about us" text anywhere.

**Honest scope note:** this is genuinely differentiated template variety —
distinct visuals, layouts, and information architecture per niche, driven by
each store's real data. It is not 23 bespoke applications: a hotel template
doesn't have a room-availability calendar, a restaurant doesn't have menu
categories or delivery-radius logic, and real estate doesn't have map/filter
search. That kind of niche-specific *functionality* is what would take this
the rest of the way to "exactly like Shopify," and each one is a substantial
build in its own right — happy to take them one at a time.

## Fixes applied (round 4 — booking calendars, delivery zones, real estate map)

The three niche-functionality gaps flagged at the end of round 3, now built:

**Booking calendars for services.** This also closed a gap that predated the
booking request: there was no way to create a service at all before this —
only products had a creation form.
- Schema: `Service.availability` (weekly working hours as JSON). `Booking`
  was fixed, not just extended — it previously had a bare `customerId`
  string field with no actual relation to `User`, meaning booking history
  couldn't be joined or queried. It now has a real `buyerId` → `User`
  relation (same pattern as `Order.buyerId`), a `storeId` for direct
  store-scoped queries, and a snapshotted `durationMins` so a later change
  to a service's duration doesn't reshape past bookings. **This changes the
  Booking table shape — run `npx prisma db push --accept-data-loss` (already
  your convention) and any pre-existing Booking rows will be dropped, same
  as any other schema change at this stage.**
- `lib/actions/service.ts` + `app/store/[slug]/admin/services/new/page.tsx` —
  vendors can now actually create a service, mark it bookable, set an
  appointment length, and set weekly hours per day.
- `lib/actions/booking.ts` — computes real open slots (working hours minus
  already-booked times that day, and never offers a past time for today).
- `components/storefront/booking-widget.tsx` — live date/slot picker
  attached to bookable services on the storefront.
- Admin Services page now shows an upcoming-bookings inbox.
- **Known simplification:** slot times are computed in server-local time,
  not the store's own timezone. Fine for a single-country launch; flag it if
  you need multi-timezone vendors later.

**Delivery zones + real menu categories for food/physical-goods stores.**
- New `DeliveryZone` model, admin CRUD at `/admin/delivery` (added to the
  sidebar — a route with nowhere to click into is the exact bug from round 2).
- Checkout now shows a zone picker, and the fee is folded into the actual
  Paystack charge (`lib/actions/order.ts` — `deliveryFee` added to `total`,
  `subtotal` kept separate so commission is still calculated on product
  revenue only, not on pass-through delivery cost).
- Storefront catalog now genuinely groups products by category once a store
  has 2+ categories in use — not food-specific, any niche using categories
  benefits. A store with one or zero categories still gets the plain flat
  grid, unchanged.

**Real estate map + filters.**
- `Product.attributes` (JSON) added for niche-specific fields — bedrooms,
  bathrooms, area, address, lat/lng — without bloating the shared `Product`
  table with real-estate-only columns every other niche would carry too.
- `components/storefront/property-catalog.tsx` — price and bedroom filters,
  client-side over the store's own listings.
- `components/storefront/property-map.tsx` — Leaflet map with price-labeled
  pins, dynamically imported so it never touches `window` during server
  rendering. Added `leaflet` + `react-leaflet` + `@types/leaflet` to
  `package.json` — run `npm install` to pick them up.
- The storefront automatically renders this instead of the generic product
  grid when a store's template category is "Real Estate & Property."
- **Known gap:** there's no admin UI yet for entering a property's
  bedrooms/bathrooms/lat-lng — those attributes exist on the schema and
  render correctly once set, but a vendor currently has no form field for
  them (the generic product form doesn't know about niche-specific
  attributes). That's the natural next step if you want to unblock real
  estate vendors specifically.

**Honest scope note, still true:** these are real, working features, not
polish. They are also still v1 versions of each — no timezone-aware booking,
no delivery-zone geofencing (a vendor names a zone, they don't draw it on a
map), no saved-search or agent contact flow for real estate. Each is a
reasonable next increment if one of these becomes the priority.

## Fixes applied (round 5 — sitewide sign-in outage, empty-template perception)

**Sign-in was broken sitewide** — not a config issue, a real regression I
introduced in round 3. `middleware.ts` imported `auth` directly from
`lib/auth.ts`, which includes the Prisma adapter and a `jwt` callback that
queries the database (the fix for the stale-role bug). Next.js Middleware
always runs on the Edge Runtime — not configurable — and Prisma Client
cannot execute there at all, so every request through middleware crashed
with `PrismaClient is not configured to run in Edge Runtime`, breaking
sign-in entirely. Fixed using Auth.js's own documented split-config pattern:
- `lib/auth.config.ts` (new) — Prisma-free base config (session strategy,
  pages, a `jwt`/`session` callback that only decodes the token). Safe for Edge.
- `lib/auth.ts` — now builds on that base config, adding the Prisma adapter,
  Credentials/Google providers, and the DB role re-check. Used by Server
  Components, Route Handlers, and Server Actions (Node.js runtime).
- `middleware.ts` — builds its own lightweight `auth()` from only the
  Edge-safe base config. Never imports `lib/auth.ts` again.
- Trade-off: middleware's coarse role pre-filter can now lag a promotion by
  one login, same as before round 3's fix — but the check that actually
  matters (`app/supaadmin/layout.tsx`) still re-checks the DB live, safely,
  since layouts run on Node.js.

**"The template looks empty."** Working as designed, but the design was
wrong: a brand-new store has zero products/services, so the storefront
correctly hid the Catalog/About/Testimonials sections rather than fabricate
content — right for a live store, but it meant every new store looked
barren before the vendor added anything, which reads as "broken template"
even when the template itself renders correctly. Fixed:
- `lib/sample-listings.ts` (new) — two realistic starter listings per niche
  (23 niches × 2), seeded automatically when a store is created
  (`lib/actions/store.ts`). Real Shopify/WooCommerce setups do the same —
  sample content the merchant edits or deletes, not permanent filler.
  Real estate samples include `attributes` (bedrooms, lat/lng) so the
  map/filter feature has something to show immediately too.
- **Backfill for stores created before this fix** (like the one in the
  screenshot): the admin Overview page now shows an "Add starter listings"
  prompt whenever a store has zero products and zero services, calling the
  new `seedSampleListings` action.
- `app/store/[slug]/page.tsx` — the split-hero's image slot (shown when no
  `bannerUrl` is set) was a flat single-color rectangle that read as an
  unfinished placeholder box. Replaced with a layered radial-gradient
  treatment plus a large faint store-initial monogram — looks intentional
  even before a vendor uploads a real photo.

## Fixes & features (round 6 — real pricing tiers, custom domains, supa admin)

**Pricing is now a real, single source of truth**, not homepage copy that
can drift out of sync with what a store actually gets:
- `prisma/seed.ts` — the `Subscription` table now has Free (unchanged) plus
  three paid tiers exactly as specified: **Entrepreneur** ₦35,000/mo,
  **Enterprise** ₦67,000/mo, **Business Mogul** ₦139,000/mo — each with its
  own commission rate, product/service caps, and a `customDomain` flag.
  Old plan names are deactivated (`isActive: false`), not deleted, so a
  store already on one keeps working.
- `app/page.tsx` — new pricing section rendered directly from the
  `Subscription` table.
- `app/store/[slug]/admin/subscription/page.tsx` — plan cards now show real
  feature comparisons, and "Upgrade" actually works (see below) instead of
  being a dead button.

**Custom domains for Enterprise and Business Mogul**, built end-to-end:
- `Store.customDomain` already existed in the schema; added
  `customDomainStatus` (`NONE`/`PENDING`/`VERIFIED`/`FAILED`).
- `lib/vercel-domains.ts` (new) — calls Vercel's REST API to actually attach
  a vendor's domain to this project. Requires `VERCEL_API_TOKEN` and
  `VERCEL_PROJECT_ID` (see `.env.example`) — without these set, the feature
  fails with a clear error rather than silently doing nothing.
- `lib/actions/domain.ts` (new) — plan-gated (`features.customDomain` must
  be true), validates the domain, checks it's not already claimed by
  another store, calls Vercel, persists status.
- **Routing** — this was the trickiest part, on purpose done carefully
  given the exact same mistake broke sign-in two rounds ago:
  `app/api/resolve-domain/route.ts` is a Node.js Route Handler that looks up
  a custom domain's store slug via Prisma. `middleware.ts` — which always
  runs on Edge and cannot use Prisma — calls that route via `fetch()` and
  rewrites the request into `/store/[slug]/*`, the same paths
  `biznest.space/store/[slug]` already uses. Known trade-off: one extra
  network round-trip per custom-domain request, since there's no edge-cached
  lookup layer yet — fine at 50-user scale, worth revisiting if custom
  domains see real traffic.
- Settings page — a plan-gated domain connection UI: enter a domain, see its
  verification status, DNS instructions (CNAME to `cname.vercel-dns.com`),
  re-check status, or remove it.

**Plan upgrades now charge real money**, not just flip a database flag:
- `lib/actions/subscription.ts` (new) — initiates a Paystack transaction
  charged directly to the platform account (no subaccount split, since this
  is the vendor paying BizNest, not a customer paying the vendor).
- `app/api/payments/paystack/subscription-callback/route.ts` (new) —
  separate from the existing order-payment callback on purpose, so the two
  can never be confused. Verifies server-side against Paystack before
  applying the plan change — the redirect alone is never treated as proof
  of payment, same discipline as the order flow.

**Supa admin now covers what was asked**: "the page for me, the builder of
the app" needs visibility into money and infrastructure, not just
moderation. Added:
- `/supaadmin/subscriptions` — MRR total, per-plan store counts, and a full
  store → plan → domain table.
- `/supaadmin/domains` — every connected custom domain across the platform,
  its status, and a manual "mark verified" override for the rare case where
  a vendor's DNS is confirmed live but Vercel's automatic check is stuck.

**On "upgrade the app features and functions to be better"** — I want to be
direct rather than pretend I acted on this: it's too broad to turn into
specific work without knowing what you mean. Everything above is concrete
and shipped. If there's a specific feature or flow you want improved next,
name it and I'll go after it the same way — real, working, and honest about
what's still simplified.

## Fixes & features (round 7 — many templates per niche, tier-gated)

**12-18 genuinely distinct templates per niche now, not 1.** Real variation,
not padding — see `lib/template-themes.ts` header for the exact formula:
every niche combines 2 color modes (its own signature palette + a neutral
light/dark inverse) × its accent colors (base + 1-2 alternates) × the 3 hero
layouts (centered/split/fullbleed). Minimum per niche is 12 (comfortably
over the 8 floor); niches with 2 alt accents get 18. Counts are fixed per
niche, not reshuffled on every deploy — a stable, reproducible catalog.

- Each generated template is its own `StoreTemplate` row with a **complete**
  resolved theme in `config` (not just category + a few overrides like
  before) — `app/store/[slug]/page.tsx` now reads a template's theme
  directly from its own config, since templates in the same category are no
  longer identical.
- `StoreTemplate.tierRank` (1-4) — **gated by pricing plan**, exactly as
  asked: Free sees rank-1 templates, Entrepreneur unlocks rank 2, Enterprise
  rank 3, Business Mogul unlocks everything. Tiers cycle through each
  niche's generated list so every plan — including Free — has real choices.
  `Subscription.features.templateTier` (added to the seed) is the source of
  truth for a plan's rank.
- `lib/actions/template.ts` — **this was a real gap, not just a UI nicety**:
  the template-selection action had zero server-side tier check before this.
  A locked template being greyed out in the gallery is only a convenience;
  the actual enforcement is here now, so the lock can't be bypassed by
  calling the action directly.
- `components/dashboard/template-gallery.tsx` — rewritten for the new
  scale: locked templates show a lock icon and their required tier instead
  of being hidden, category filter chips (essential now with 12-18 per
  niche instead of 1), and each preview renders that specific template's
  own stored theme rather than one shared per-category default.

## Fixes & features (round 8 — empty-after-switch, uneditable About text, section control)

**Confirming a scope gap directly, not glossing over it:** what this app has
is a fixed, code-defined section order per template that shows or hides
based on whether real data exists. What Shopify actually has is a full
block-level page builder — merchants add, remove, reorder, and edit the
content of arbitrary sections. Those are fundamentally different amounts of
engineering. This round ships the real *first* piece of the second one
(arrangement control), not the whole thing — said plainly rather than
implied to be more than it is.

**Two concrete bugs, both from the same screenshot:**
- `lib/actions/template.ts` — switching templates never seeded sample
  listings, only initial store creation did. A store that switched templates
  from an empty state (or predated the sample-listings feature) stayed
  empty after switching, which is exactly what made a freshly-picked
  template look "plain, no demo." Now calls the same `seedSampleListings`
  used elsewhere — safe, since it's a no-op if the store already has real
  listings.
- `Business.description` (the storefront's About text) was only ever set
  once, during onboarding, with **no edit path afterward** — the actual
  cause of the garbled placeholder text stuck on a live storefront. Added a
  real textarea to Settings, wired through `updateStoreSettings`.

**New: section arrangement control**, the real building block toward "take
out what you don't need, add what you need":
- `Store.sectionOverrides` (new field) — `{ order, hidden }`.
- `lib/actions/sections.ts` (new) — hero can never be hidden; everything
  else can be reordered or toggled off.
- `components/dashboard/section-editor.tsx` (new) — up/down reordering (no
  drag-and-drop library dependency) and hide checkboxes, on the Website
  Builder page.
- `app/store/[slug]/page.tsx` — applies the override on top of the
  template's default order. A hidden-but-empty distinction still holds: a
  section absent of real data won't render even if not explicitly hidden —
  this feature controls arrangement, not fabrication.

**Still not built, said explicitly:** per-section *content* editing (e.g.
rewriting the About section's layout, adding a custom block, editing hero
copy without going through Settings), drag-and-drop (this is click-to-move),
and anything resembling Shopify's Liquid/theme-file architecture. Arrangement
control was the buildable, honest next increment — content-block editing is
the next one after that, and it's the bigger of the two.

## Fixes & features (round 9 — sidebar scroll, dedicated layout page, richer sections, gallery previews)

**Sidebar scroll bug — real CSS fix, not a workaround.** `app/store/[slug]/admin/layout.tsx`'s
outer container had no height constraint, so the sidebar scrolled along with
page content instead of staying put. Fixed with the standard pattern:
outer container `h-screen overflow-hidden`, sidebar gets its own bounded
height with independent internal scroll for its nav list, main content
`flex-1 overflow-y-auto`. Scrolling the page now never moves the sidebar.

**Section arrangement moved to its own page**, renamed for clarity: `/store/[slug]/admin/layout-editor`, labeled **"Storefront Layout"** in the
sidebar (distinct from "Website Builder," which is now template selection
only — the previous page mashed both together, which is what made it
confusing to find).

**Real "add what you need," not just "remove what you don't"** — 3 new
opt-in section types, none of them fabricated:
- **Stats bar** — real counts only: listing count, average rating (from
  actual reviews), completed orders. Doesn't render at all if there's
  nothing real to show.
- **Why shop here (feature grid)** — dynamically includes only what the
  store actually has: verified badge, delivery (only if the store has
  active delivery zones), instant booking (only if it has bookable
  services). "Secure payments" is the one static claim, and it's true —
  every checkout runs through Paystack.
- **Email signup** — this is a genuinely new, working feature, not a
  decorative form: `NewsletterSubscriber` (new model) actually captures
  emails per store via `lib/actions/newsletter.ts`. No admin UI to view
  the list yet — that's the natural next step if this gets used.

**Template gallery previews now structurally differ**, not just in color —
this was the exact gap in the screenshot showing three "Architecture &
Design Studio" cards that all looked like the same card in different
shades. Centered/split/fullbleed now render as genuinely different mini-
layouts (split shows a real two-column split, fullbleed shows text
overlaid on a color wash, centered is centered) in
`components/dashboard/template-gallery.tsx`.

**On the 20 reference designs**: understood clearly, and worth being exact
about the gap they reveal — those are photography-driven, higher
information-density layouts (stat bars, feature grids, newsletter capture,
dense footers). The structural elements (stats/features/newsletter, above)
are now real and built the same way real theme systems build them — from
actual data, not filler. The photography itself is the one piece not
addressed this round: matching it needs either stock-photo integration
(e.g. Unsplash API, requires an access key) or vendor-uploaded images,
which is a reasonable, scoped next addition if that's the priority.

## Fixes & features (round 10 — real uploads everywhere, auto-populated demo photography)

**Correction to what I said last round:** upload infrastructure already
existed — `/api/upload` (authenticated, Cloudinary-backed) plus two working
components (`FileUploadField`, `MultiImageUpload`), already wired into
product creation. The actual gaps, now closed:

- **Settings had zero logo/banner upload** — `Store.logoUrl`/`bannerUrl`
  were read everywhere (storefront header, hero fallback, gallery) but
  never once settable. `components/forms/logo-banner-fields.tsx` (new) is a
  small client island that slots into Settings' otherwise-plain
  server-rendered form via hidden inputs — `updateStoreSettings` now
  actually persists both.
- **Service creation had no image upload at all**, and even if it had,
  **the storefront never rendered service images anyway** — both fixed:
  `ServiceImagesField` (new) reuses `MultiImageUpload` (now takes a `label`
  prop instead of a hardcoded "Product images"), and the storefront's
  service cards now show the first uploaded image, matching how product
  cards already worked.

**Auto-populated demo photography** — `lib/unsplash.ts` (new), entirely
optional via `UNSPLASH_ACCESS_KEY`:
- Sample listings seeded at store creation, template switch, or the
  "Add starter listings" button now get a real matching stock photo per
  item, not just a name and price.
- A store's banner auto-fills with a niche-relevant photo *only if* the
  vendor hasn't set one — a real upload always wins and is never overwritten.
- Fetched **once, at creation/seeding time, and persisted** — never on a
  storefront page view. `createStore`'s photo fetches happen *before* its
  DB transaction opens, not inside it — holding a transaction open across
  external HTTP calls risks connection timeouts, so photos are resolved
  first and passed in as plain values.
- Without a key configured: every function in `lib/unsplash.ts` returns
  `null`, and every caller already had a fallback (CSS gradient/monogram)
  from before — nothing breaks, it just looks like it did previously.

**Honest remaining gap:** this closes vendor uploads and automatic demo
photography for *listings*. It does not add a stock-photo picker inside the
manual upload flow (e.g. "search Unsplash" button next to the upload
button) — vendors can only upload their own or get what's auto-generated at
creation time. That's a reasonable next increment if wanted.

## What's next toward the Shopify/WooCommerce bar (round 4)

This pass fixed what was broken. Bigger lifts still ahead, roughly in priority order:
1. Product variants/attributes (size, color) — core WooCommerce parity gap.
2. Website Builder drag-and-drop section editor (currently JSON-only `StorePage.content`).
3. Booking flow UI for bookable services (schema exists, no admin/customer UI yet).
4. Real-time order/message notifications.
5. Storefront theme picker in Settings (swap between curated palettes per niche, not just color tweaks).


Deploying to Vercel: connect the repo, add the same env vars in Project Settings →
Environment Variables, and set `DATABASE_URL` to a Vercel Postgres/Neon instance.
Prisma migrations run via `npm run build` (`prisma generate` is wired into the
build script) — run `npx prisma migrate deploy` against production once before
first deploy.

## Try the flow end-to-end

1. `/register` → verify email (check Resend logs/dev inbox)
2. `/login`
3. `/onboarding/business-verification` → fill in details, pick a path, submit
4. (Phase 2 adds the admin approval screen — for now, flip `verificationStatus`
   to `APPROVED` directly in Prisma Studio to continue testing: `npm run db:studio`)
5. `/onboarding/fraud-policy` → accept
6. `/onboarding/create-store` → name your store
7. Redirected to `/store/<slug>/admin` — the dashboard shell
8. Visit `/store/<slug>` — the public storefront

## Roadmap — remaining phases

Each phase below is independently buildable, testable, and deployable, per the
spec's own instruction to build incrementally. Suggested order:

**Phase 2 — Admin & moderation**
Platform admin dashboard (`/admin`): approve/reject/suspend businesses, manage
categories, manage store templates, manage commissions, ban users, moderate
reviews/disputes. This unblocks testing Phase 1's approval-gated flow for real.

**Phase 3 — Catalog & storefront**
Product/service CRUD in the store dashboard, image upload + Cloudinary
transforms, inventory management, category browsing, search, the 25 website-
builder templates as real page-builder layouts (drag/drop block editor).

**Phase 4 — Orders, payments, escrow, disputes**
Paystack/Flutterwave OAuth-style seller account linking, checkout flow, order
state machine, commission calculation, buyer-confirms-completion escrow
release, dispute submission + admin resolution UI.

**Phase 5 — Reviews, messaging, notifications**
Order chat, buyer/seller messaging, review + response UI with photo/video
upload, in-app + email + push notifications.

**Phase 6 — AI features**
Product/service description generator, SEO generator, background removal,
image enhancement, logo generator, marketing copy, social captions, FAQ
generator — each as a thin wrapper around a model API call, gated behind
subscription tier.

**Phase 7 — Bookings/appointments, coupons, subscriptions, analytics**
Service booking calendar, coupon redemption at checkout, subscription
tier upgrades/downgrades with Paystack/Flutterwave billing, analytics
dashboards.

**Phase 8 — Hardening**
Rate limiting, CSRF, audit log UI, accessibility pass, Lighthouse tuning,
custom domain support (`staceys-paradise.biznest.com`), 2FA UI, load testing.

## Fixes & features (round 11 — hardening pass: tests, error pages, rate limiting, migration safety)

**Honest framing first:** this round doesn't have network access to `npm install`
or actually run `npm test` — everything below is written and wired correctly,
but you'll want to run `npm install && npm test` yourself once to confirm
green before trusting it in CI.

**Automated tests, starting where the money math lives.** There were zero
tests in the codebase before this. Rather than a token test file, I pulled
the order/commission calculation out of `lib/actions/order.ts` (which can't
be unit tested directly — it's a Server Action that hits Prisma, auth, and
Paystack) into a pure function:
- `lib/utils/pricing.ts` (new) — `calculateOrderTotals`, with the exact rule
  that was previously just a comment: commission is computed on subtotal
  only, delivery fee is never part of the commission base. `order.ts` now
  calls this instead of inlining the math.
- `lib/utils/slug.ts` — `generateUniqueStoreSlug` now accepts an injectable
  `slugExists` checker (defaults to the real Prisma lookup), so the
  collision-retry loop — including the exact "two people both name their
  store 'Stacey's Paradise'" scenario from the design notes below — is
  covered by a test that never touches a database.
- `lib/rate-limit.ts` — tests via a mocked Prisma client (in-memory Map
  standing in for the `RateLimitEntry` table), covering the fixed-window
  boundary, the reset-after-expiry case, and independent bucketing by key.
- `vitest.config.ts` (new) + `vitest` devDependency + `npm test` script.
  Chose Vitest over Jest since the project is already ESM/TS-native and
  Vitest needs near-zero config for that.
- **What's still untested:** anything that requires a real Postgres
  connection (Server Actions end-to-end, the Prisma-backed parts of
  `checkRateLimit`, the KYC discriminated-union validation). That needs
  either a test database or a heavier mocking layer than was worth adding
  in one pass — a reasonable next increment if you want DB-backed
  integration tests specifically.

**Error/loading/not-found pages** — there were none anywhere in `app/`,
so any thrown error fell through to Next's default unstyled error screen.
Added, all matching the existing aubergine/marigold/jade palette:
- `app/error.tsx`, `app/not-found.tsx`, `app/loading.tsx` — global fallback.
- `app/store/[slug]/error.tsx`, `app/store/[slug]/not-found.tsx` — storefront-scoped, so a broken product page doesn't take down the whole site shell.
- `app/store/[slug]/admin/error.tsx` — dashboard-scoped, keeps the sidebar/layout chrome around a failed page instead of blanking the whole screen.
- `app/supaadmin/error.tsx` — same idea for the platform admin panel.

**Rate limiting extended past login/register**, using the existing
Postgres-backed `checkRateLimit` — it was wired into `lib/actions/auth.ts`
only, leaving several abuse-prone endpoints open:
- `app/api/upload/route.ts` — 20 uploads / 10 minutes, keyed per user ID
  (not IP, since it's already auth-gated).
- `app/api/payments/paystack/callback/route.ts` and the Flutterwave/
  subscription equivalents — 30 requests / minute, keyed per order/reference
  ID, since these are unauthenticated redirect targets and a natural target
  for someone hammering a reference to see what sticks.
- `lib/actions/booking.ts` (`createBooking`) — 10 attempts / 5 minutes per
  user, since unrestricted booking creation could be used to spam a
  vendor's calendar.
- `lib/actions/coupon.ts` (`createCoupon`) — 20 / 10 minutes per store,
  loose on purpose since this is a store-owner-only action, just a backstop
  against a runaway script.
- **Not yet covered:** most other Server Actions (product/service creation,
  review submission, messaging). Same pattern, straightforward to extend —
  flagged rather than silently done, since claiming "rate limiting is now
  everywhere" would be the same kind of gap this round is trying to close.

**Migration safety — flagged, not silently changed.** I said last round the
`build` script's `prisma db push --accept-data-loss` was a landmine for
production. The honest complication: there are currently **no Prisma
migration files** in this repo (`prisma/migrations/` doesn't exist) — the
whole project history has been built on `db push`. Swapping `build` to
`prisma migrate deploy` right now would just fail, since there's nothing to
deploy. So, instead of a change that looks like a fix but breaks the build:
- Added `db:migrate:deploy` script for once migrations exist.
- **Action needed from you, once, before this matters:** run
  `npx prisma migrate dev --name init` locally against a real database to
  generate the initial migration from the current schema, commit
  `prisma/migrations/`, then swap `build`'s `prisma db push --accept-data-loss`
  to `prisma migrate deploy`. I didn't do this myself because generating a
  migration needs a live database connection this environment doesn't have
  — doing it blind risks baking in an incorrect migration.

## Notes on decisions made

- **Role promotion happens at store creation**, not at business approval — a
  user can be verified without yet committing to opening a store.
- **Slugs** are generated server-side with a collision-retry loop
  (`lib/utils/slug.ts`) rather than trusting a client-supplied slug, so two
  people naming stores "Stacey's Paradise" both succeed (`staceys-paradise`,
  `staceys-paradise-2`).
- **Money fields use `Decimal(12,2)`**, not floats — required for anything
  touching payments.
- **Guarantors are exactly 2**, enforced by Zod's `.length(2)`, matching the
  spec precisely rather than "at least 2."
