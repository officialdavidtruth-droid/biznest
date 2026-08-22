// PlatformSetting key names, centralized so nothing typos a key string in
// three different files. Deliberately NOT in lib/actions/site-settings.ts —
// "use server" files may only export async functions, and this is a plain
// object.
export const SETTING_KEYS = {
  MAINTENANCE: "site.maintenance",
  ANNOUNCEMENT: "site.announcement",
  ACTIVE_GATEWAY: "payments.active_gateway",
  LOYALTY_RATES: "loyalty.rates",
  FREE_TRIAL: "billing.free_trial",
} as const;
