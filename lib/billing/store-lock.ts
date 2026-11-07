/**
 * A store with no plan (trial ended, plan lapsed, or never chosen) is locked: its owner can't use the dashboard
 * (see the admin layout) and customers can't browse, check out or book. Orders already paid still pay out.
 *
 * Marketing-only accounts never have a storefront or plan, so they are not "locked". STORE_LOCK_EXEMPT_SLUGS
 * (comma-separated) keeps named stores such as demos live, and STORE_LOCK=off turns enforcement off entirely.
 */
type LockFields = { subscriptionId: string | null; marketingOnly?: boolean | null; slug?: string | null };

export const STORE_LOCKED_MESSAGE = "This store is temporarily unavailable.";

export function isStoreLocked(store: LockFields): boolean {
  if (process.env.STORE_LOCK === "off") return false;
  if (store.subscriptionId || store.marketingOnly) return false;
  const exempt = (process.env.STORE_LOCK_EXEMPT_SLUGS ?? "").split(",").map((s) => s.trim().toLowerCase()).filter(Boolean);
  if (store.slug && exempt.includes(store.slug.toLowerCase())) return false;
  return true;
}
