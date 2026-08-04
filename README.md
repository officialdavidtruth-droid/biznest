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

## What's next toward the Shopify/WooCommerce bar

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
