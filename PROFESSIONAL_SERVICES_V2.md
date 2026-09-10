# BizNest Professional Services V2

This upgrade makes **Professional Services** a parent business category with specialized sub-niches.

## Sub-niches

- Graphic Design & Printing
- Branding & Brand Identity
- Marketing & Digital Agency
- Photography & Visual Production
- Consulting & Advisory
- Accounting & Finance
- Legal Services
- HR & Recruitment
- Web & Software Development
- IT & Technology Services
- Architecture & Interior Design
- Engineering Services
- Construction & Building

## Specialized experience

Each sub-niche has its own recommended services, customer journey, navigation, onboarding questions, email themes and storefront language.

### Graphic Design & Printing

Adds a project-first workflow:

`Brief → Quote → Design → Approval → Production → Quality Check → Ready → Delivery`

Customers can submit a project brief from the storefront. The business receives the request in **Admin → Projects**, can change the production status, upload design revisions and send a secure review link. Customers can approve a revision or request changes.

## Data model

`Business.businessSubcategory` stores the selected specialty.

`CreativeProject` stores project briefs and workflow state.

`CreativeProjectRevision` stores design versions and approval notes.

The new Prisma migration is `20260830170000_professional_services`.

## Important deployment note

Run the normal BizNest build command so Prisma generates the updated client and applies the migration:

`npm run build`
