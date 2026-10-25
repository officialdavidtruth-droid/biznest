# Referrals and gift cards

## What was added
- **Schema + migration** `20261027090000_referrals_gift_cards`: `GiftCard`, `GiftCardTransaction` (ledger), `ReferralCode`, `Referral`, three enums, and three defaulted columns on `Store` (`referralEnabled`, `referralReferrerPoints`, `referralRefereePoints`). DB CHECK constraints keep gift-card balance >= 0 and block self-referral.
- **Referrals** (off by default, per store). A customer gets one code per store. A friend joins via `/register?store=<slug>&ref=<CODE>` or enters the code in Account → Refer a friend (only before their first order). When the friend's **first order is COMPLETED**, both sides get store loyalty points (`StoreLoyaltyEntry`, type ADJUSTMENT). Exactly-once: status-guarded update + unique `qualifyingOrderId`. Hooked into `awardStoreLoyaltyPointsForOrder`, so it fires from both existing completion paths (orders and FnB kitchen) with no change to `order.ts` / `fnb.ts`.
- **Gift cards** (store-scoped). Merchant issues cards (Admin → Grow → Gift cards), disables/enables them, and deducts them for in-store purchases. Customers can check a balance by code (rate-limited) and see cards sent to their *verified* email in Account → Gift cards. All balance changes go through `lib/payments/gift-card-ledger.ts` (atomic conditional decrement + ledger row).

## Deliberately NOT done: gift cards / coupons at online checkout
`startCheckout` has no discount mechanism at all (the existing `Coupon` model is not applied to product orders either), and settlement verifies `amount paid == order.total`. Letting a gift card pay part of an online order changes what is charged at the gateway, how commission/merchant split are computed, and what a refund returns. `redeemGiftCard` and `refundGiftCardRedemptionsForOrder` are ready for that wiring once those rules are decided.

## Run
1. `npx prisma migrate deploy` (or `migrate dev`) then `npx prisma generate`.
2. `npx vitest run lib/payments/__tests__` (new: `gift-card-ledger`, `referral-award`; `settlement-not-public` extended).
