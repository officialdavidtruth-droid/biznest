-- Records the subaccount a charge was actually split to at charge time,
-- so refund clawback logic doesn't have to infer it from the store's
-- current payout connection state.
ALTER TABLE "Payment" ADD COLUMN "splitSubaccountCode" TEXT;
