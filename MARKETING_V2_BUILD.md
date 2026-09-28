# BizNest Marketing V2 build

This build upgrades the standalone Marketing workspace from a basic CRM/email surface into a marketing command center and adds a Canva email-design integration.

## Added

- Marketing Command Center with acquisition, audience, campaign, automation, analytics and growth-tool navigation.
- Growth opportunity cards driven by the account's current CRM/contact/campaign/automation data.
- Standalone growth-tool architecture for AI Marketing, smart audiences, campaigns, design studio, journeys, landing pages, lead finder, SMS/WhatsApp, content calendar and analytics.
- Canva OAuth 2.0 + PKCE connection flow.
- Encrypted Canva access/refresh token storage.
- Canva email design creation (preset email designs, or an optional Canva brand-template ID).
- "Edit in Canva" action from the BizNest email composer.
- Canva email export polling and HTML import back into the BizNest composer.
- Imported Canva HTML can be stored as `customHtml` in the campaign content and sent through the existing Resend pipeline.
- Basic email safety sanitisation for imported HTML and automatic BizNest unsubscribe footer injection.
- Public marketing landing page updated to describe the full standalone growth platform rather than only CRM/email/automation.
- Prisma `CanvaConnection` model and migration.

## Canva setup

Create a Canva app in the Canva Developer Portal and enable the REST API. Configure the redirect URL:

`https://biznest.space/api/integrations/canva/callback`

Request at least:

- `design:content:read`
- `design:content:write`
- `design:meta:read`
- `asset:read`
- `profile:read`

Set these environment variables in production:

- `CANVA_CLIENT_ID`
- `CANVA_CLIENT_SECRET`
- `CANVA_REDIRECT_URI`
- `CANVA_TOKEN_ENCRYPTION_KEY` (a long random secret)
- `NEXT_PUBLIC_CANVA_EMAIL_BRAND_TEMPLATE_ID` (optional)

The optional brand-template ID lets BizNest create a new editable Canva email from a Canva brand template. Without it, BizNest creates a blank Canva Email design and the merchant can design it in Canva.

Canva currently supports exporting Email designs as `html_bundle` or `html_standalone`; BizNest uses `html_standalone` so the finished design can be imported back into the email campaign workflow.

## Important provider dependencies

The UI now exposes the architecture for SMS/WhatsApp/social/lead-finder/landing-page/AI/analytics modules, but those capabilities still require their respective provider credentials and production data pipelines. The build does not fake provider delivery.
