# Store tracking & analytics (GA4, Meta Pixel, Plausible)

Each store owner can connect their own analytics / ad-conversion IDs in
**Dashboard → Settings → Tracking & analytics**. Leave a field empty to switch
that provider off. A store with no IDs loads no third-party scripts at all.

| Provider | What the owner enters | Stored in `Store` |
|---|---|---|
| Google Analytics 4 | Measurement ID, `G-XXXXXXXXXX` | `trackingGaId` |
| Meta (Facebook/Instagram) Pixel | Pixel ID, digits only | `trackingMetaPixelId` |
| Plausible | Site domain as registered, `mystore.com` | `trackingPlausibleDomain` |

## Events reported

| Moment | GA4 | Meta | Plausible |
|---|---|---|---|
| Any page / route change | `page_view` | `PageView` | `pageview` |
| Product or service page | `view_item` | `ViewContent` | `View Item` |
| Add to cart (every template) | `add_to_cart` | `AddToCart` | `Add to Cart` |
| Checkout page opened | `begin_checkout` | `InitiateCheckout` | `Begin Checkout` |
| Paid order / paid booking | `purchase` | `Purchase` | `Purchase` (with revenue) |
| Booking with no online payment | `generate_lead` | `Schedule` | `Booking Request` |

Conversions fire once per order/booking id per browser (refreshing the
confirmation page does not double-count). Orders still `PENDING_PAYMENT`,
cancelled, refunded or disputed are never reported as purchases.

## Where the code lives

- `lib/tracking/ids.ts` — strict validation of the three IDs (used on save **and** at render).
- `lib/tracking/client.ts` — provider loaders + `trackEvent` / `trackPageView`.
- `components/storefront/store-tracking.tsx` — `<StoreTracking>` (mounted in `app/store/[slug]/layout.tsx`) and the per-page event components.
- `lib/actions/tracking.ts` — `saveTrackingIds` (needs the `settings` permission; audit-logged as `settings.tracking_updated`).
- `lib/cart-context.tsx` — `addItem` is the single hook for add-to-cart across all templates.
- `next.config.js` — CSP allows the Google, Meta and Plausible hosts. **If a provider is added, its hosts must be added here or the browser will silently block it.**

## Guarantees

- Never loaded or fired on `/admin`, `/account` or `/wallet-pay` URLs, for suspended stores, or for marketing-only stores.
- Events are addressed to the *current* store's IDs only (`gtag send_to`, `fbq trackSingle`, explicit Plausible `domain`), so client-side navigation between two stores can't leak events across them.
- Only product ids/names, prices, currency and order totals are sent. Never customer names, emails or phones. Meta's automatic form-field matching is turned off.
- Plausible is sent via its Events API (no script); `localhost` and `localStorage.plausible_ignore = "true"` are ignored, as with Plausible's own script.

## Not included (decide before adding)

- **Cookie-consent banner.** Nothing here gates scripts on consent. If stores serve EU/UK visitors, or Nigeria NDPA guidance requires opt-in for your use, add consent gating before `registerTracking` runs.
- Google Ads (`AW-`) and Tag Manager (`GTM-`) IDs, TikTok/Snap pixels, and Meta Conversions API (server-side). `eventID` is already sent on Purchase so a CAPI feed can de-duplicate later.
- Self-hosted Plausible (would need a configurable host in the CSP).
- Events on hotel room pages (`/rooms/[roomSlug]`) and the multi-step hotel `/book/*` flow; the booking *confirmation* page is covered.
- Owner/staff browsing their own live storefront while signed in still counts as traffic (use GA's internal-traffic filter or Plausible's exclude-self).

## Deploy

`npm run build` runs `prisma migrate deploy`, which applies
`20261026090000_store_tracking_ids` (three nullable columns, no backfill).
