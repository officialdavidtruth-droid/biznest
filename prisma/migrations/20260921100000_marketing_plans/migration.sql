-- The isMarketingPlan column added to the Subscription model in
-- schema.prisma alongside this migration -- must actually be created here
-- before the seed insert below can reference it.
ALTER TABLE "Subscription" ADD COLUMN IF NOT EXISTS "isMarketingPlan" BOOLEAN NOT NULL DEFAULT false;

-- Seeds the two BizNest Marketing pricing tiers (Starter + Pro) requested
-- by the business owner. Per their instruction, SupaAdmin owns both the
-- actual prices and which tier (if any) gets the free trial -- neither is
-- hardcoded here:
--   * Price starts at 0 and is set for real via the existing "Billing --
--     plan pricing" table at /supaadmin/settings (updatePlanPricing in
--     lib/actions/admin.ts) -- the exact same UI/action every other plan's
--     price already goes through, nothing new to build there.
--   * The free trial is the platform's existing single "billing.free_trial"
--     setting (FreeTrialForm on that same page) -- it can point at ANY
--     plan, either product, so SupaAdmin can pick Starter, Pro, both in
--     turn, or neither. No separate marketing-trial mechanism was added.
--
-- isMarketingPlan = true keeps these two out of the main platform's plan
-- lists (landing page pricing, /onboarding/select-plan, a store's own
-- /admin/subscription page -- see the isMarketingPlan filters added
-- alongside this migration) and out of the marketing plan picker's
-- opposite number.
INSERT INTO "Subscription" ("id", "name", "price", "interval", "features", "commissionRate", "isActive", "isMarketingPlan")
VALUES
  (gen_random_uuid()::text, 'Marketing Starter', 0, 'MONTHLY', '{}'::jsonb, 0, true, true),
  (gen_random_uuid()::text, 'Marketing Pro',     0, 'MONTHLY', '{}'::jsonb, 0, true, true)
ON CONFLICT ("name") DO NOTHING;
