/**
 * Every scheduled job, in one place. Must stay in sync with vercel.json
 * (lib/__tests__/cron-registry.test.ts fails the build if it drifts).
 *
 * maxAgeHours: how long after its last successful run a job counts as
 * overdue. Daily jobs get 26h (24h + slack for Vercel scheduling jitter).
 */
export type CronDef = { name: string; path: string; schedule: string; maxAgeHours: number };

export const CRONS: CronDef[] = [
  { name: "payouts", path: "/api/cron/payouts", schedule: "0 3 * * *", maxAgeHours: 26 },
  { name: "channel-sync", path: "/api/cron/channel-sync", schedule: "30 4 * * *", maxAgeHours: 26 },
  { name: "payment-reconciliation", path: "/api/cron/payment-reconciliation", schedule: "15 5 * * *", maxAgeHours: 26 },
  { name: "subscription-renewals", path: "/api/cron/subscription-renewals", schedule: "0 6 * * *", maxAgeHours: 26 },
  { name: "watchdog", path: "/api/cron/watchdog", schedule: "30 7 * * *", maxAgeHours: 26 },
  { name: "payout-verification", path: "/api/cron/payout-verification", schedule: "0 9 * * *", maxAgeHours: 26 },
  { name: "churn-watch", path: "/api/cron/churn-watch", schedule: "0 10 * * *", maxAgeHours: 26 },
  { name: "weekly-chores", path: "/api/cron/weekly-chores", schedule: "30 5 * * 1", maxAgeHours: 170 },
  { name: "month-end-export", path: "/api/cron/month-end-export", schedule: "0 8 1 * *", maxAgeHours: 746 },
  { name: "abandoned-checkout-alerts", path: "/api/cron/abandoned-checkout-alerts", schedule: "0 12 * * *", maxAgeHours: 26 },
  { name: "transfer-order-followup", path: "/api/cron/transfer-order-followup", schedule: "0 11 * * *", maxAgeHours: 26 },
  { name: "webhooks", path: "/api/cron/webhooks", schedule: "0 18 * * *", maxAgeHours: 26 },
  { name: "quote-expiry", path: "/api/cron/quote-expiry", schedule: "45 0 * * *", maxAgeHours: 26 },
  { name: "daily-summary", path: "/api/cron/daily-summary", schedule: "0 20 * * *", maxAgeHours: 26 },
];

export const CRON_BY_NAME: Record<string, CronDef> = Object.fromEntries(CRONS.map((c) => [c.name, c]));
