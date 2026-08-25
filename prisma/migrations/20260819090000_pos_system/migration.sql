-- Order Recovery: lets a signed-in customer reclaim an order that's stuck
-- on a different/old account (e.g. they got logged out mid-checkout and
-- signed back in as a different account than the one the order was placed
-- under, or an OAuth login created a second account for the same email).
--
-- Recovery is a two-step, email-verified claim (see lib/actions/order-recovery.ts):
-- 1. Customer enters the email used at checkout; we look up unclaimed
--    orders at this store for that email and send a one-time code.
-- 2. Customer enters the code; on match, the order's buyerId is
--    reassigned to their current, signed-in account.
-- Reuses the existing VerificationToken table rather than a new one.

ALTER TYPE "VerificationTokenType" ADD VALUE 'ORDER_RECOVERY';