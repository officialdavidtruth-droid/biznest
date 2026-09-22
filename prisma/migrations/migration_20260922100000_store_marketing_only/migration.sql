-- Marks a store created through the lightweight /marketing/signup flow.
-- These stores have no storefront/catalog and never get admin dashboard
-- access (see app/store/[slug]/admin/layout.tsx and
-- lib/access/marketing-tool.ts).
ALTER TABLE "Store" ADD COLUMN "marketingOnly" BOOLEAN NOT NULL DEFAULT false;
