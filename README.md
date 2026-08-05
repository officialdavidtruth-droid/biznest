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
