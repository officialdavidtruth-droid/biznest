 # Rule-based Marketing Email Curation

BizNest Marketing now curates the visible email designs from the verified website profile without an AI/model call.

## Inputs

- Connected website `businessType`
- Connected website business description
- Scanned catalog item types (`product` / `service`)
- Existing store business type when no website is connected
- Website-derived branding is already applied through `buildMarketingBrand`

## Visible curated set

- Luxury Signature (`luxury`)
- Welcome (`welcome`)
- Premium Offer (`premium_offer`)
- Editorial Story (`editorial`)
- Restaurant (`restaurant`)
- Product Launch / Anticipation (`launch`)

Legacy templates remain registered for historical campaign rendering, but the Marketing composer only exposes the six curated designs.

## Example rules

- Hotel/resort/accommodation → Luxury, Welcome, Premium Offer, Editorial, Launch, Restaurant.
- Restaurant/food/menu → Restaurant, Editorial, Premium Offer, Luxury, Launch, Welcome.
- E-commerce/product catalog → Premium Offer, Luxury, Editorial, Launch, Welcome, Restaurant.
- Service/professional/beauty → Editorial, Welcome, Luxury, Premium Offer, Launch, Restaurant.
- Unknown/general → Editorial, Welcome, Premium Offer, Luxury, Launch, Restaurant.

The ordering is deterministic and transparent. Each recommended template also shows the reason it was surfaced.
