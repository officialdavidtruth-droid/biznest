BizNest — Newsletter Audit Round 5

Purpose:
Add a real, working newsletter subscription surface to the templates that were missing one.

New shared component:
components/storefront/storefront-newsletter.tsx

Replace these files at their original paths:
components/storefront/templates/arcova-home.tsx
components/storefront/templates/fabtex-home.tsx
components/storefront/templates/hotel-chrome.tsx
components/storefront/templates/professional-services-home.tsx
components/storefront/templates/signature-home.tsx
components/storefront/templates/fresh-chrome.tsx
components/storefront/signature-screenshot-home.tsx

The other templates already contain newsletter subscription implementations and were left unchanged.

No Prisma migration is required. The form uses the existing subscribeToNewsletter server action and stores subscribers per store.
