/**
 * Percentage of each sale BizNest keeps. Zero by design: stores receive 100% of
 * what their customers pay and BizNest earns only from subscription plans.
 * Gateway fees are not BizNest's cost: they are held back from the vendor's
 * payout (see lib/payments/gateway-fee.ts).
 */
export const PLATFORM_COMMISSION_PERCENT = 0;
