# BizNest Branded Email Marketing Studio

This upgrade adds a merchant-facing email marketing system designed around the existing BizNest store branding and business niche.

## What is included

- `/store/[slug]/admin/marketing` is now a real email campaign studio.
- Six visual campaign layouts:
  - Big announcement
  - Product showcase
  - Offer / promotion
  - Monthly newsletter
  - Service spotlight
  - Hotel / booking
- Store logo, colors, font, contact details, social links and banner are automatically pulled into the email.
- Published products/services are pulled into the composer so campaigns can use real storefront imagery and links.
- Industry-aware starter copy changes for hospitality, food, beauty, professional services and product businesses.
- Live responsive HTML email preview while editing.
- Active newsletter subscribers are the marketing audience; unsubscribed addresses are automatically excluded.
- Per-recipient signed unsubscribe links and a working `/unsubscribe` page.
- Campaign history with sent/failed/partial status and counts.
- Prisma migration for `EmailCampaign` and subscriber opt-out timestamps.
- Existing Marketing navigation and staff permission model are reused.

## Environment

Existing `RESEND_API_KEY` and `EMAIL_FROM` are used for delivery.

For unsubscribe signing, `NEWSLETTER_UNSUBSCRIBE_SECRET` is recommended. If it is not set, the existing `AUTH_SECRET` is used.

## Important deployment note

Run the normal BizNest build/deploy so Prisma applies the new migration:

`prisma migrate deploy`

The project build script already runs migrations before `next build`.
