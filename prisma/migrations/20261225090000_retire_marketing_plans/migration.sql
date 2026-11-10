-- BizNest now sells three plans (Starters, Entrepreneurship, Business Mogul). The two Marketing plans were
-- never priced or offered anywhere, so retire them. They are hidden, not deleted, in case a store still points at one.
UPDATE "Subscription" SET "isActive" = false WHERE "name" IN ('Marketing Starter', 'Marketing Pro');
