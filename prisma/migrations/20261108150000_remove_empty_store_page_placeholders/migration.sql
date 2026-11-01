-- Remove the empty StorePage rows that store creation used to seed for every page name
-- (home, about, products, testimonials, ...). They held { "blocks": [] } and no body, so they showed up as
-- blank "published" pages and as dead entries in Customize > Pages.
-- Only the exact placeholder shape is deleted. Owner text pages ({ "body": ... }) and template content
-- (hotel-*, events, tastehouse-home, template galleries) are never touched.
DELETE FROM "StorePage" WHERE "content"::jsonb = '{"blocks": []}'::jsonb;
