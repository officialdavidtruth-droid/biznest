/**
 * Churn watch: pure detection of "this store may be about to leave" signs.
 * No I/O here so it is trivially unit-testable; lib/churn/run.ts feeds it
 * data and persists the result.
 */
export type ChurnKind = "NO_LOGIN" | "NO_ORDERS" | "PAYMENT_FAILED" | "UNUSED_PLUGIN";

export const CHURN_THRESHOLDS = {
  noLoginDays: 7,
  noOrderDays: 14,
  unusedPluginDays: 14,
} as const;

export type StoreSnapshot = {
  now: Date;
  storeCreatedAt: Date;
  /** Owner's last recorded sign-in; null = not recorded yet. */
  ownerLastLoginAt: Date | null;
  /** Latest paid/in-progress/completed order, null = never. */
  lastOrderAt: Date | null;
  /** Latest StoreActivityLog entry, null = none. */
  lastActivityAt: Date | null;
  /** Set when the store's plan renewal charge failed. */
  subscriptionPastDueSince: Date | null;
  /** Active installed plugins that cost money. */
  paidPlugins: { key: string; name: string; installedAt: Date; pastDueSince: Date | null }[];
};

export type DetectedSignal = { kind: ChurnKind; subject: string; detail: string };

const DAY = 86_400_000;
const daysBetween = (a: Date, b: Date) => Math.floor((a.getTime() - b.getTime()) / DAY);

export function detectChurnSignals(s: StoreSnapshot): DetectedSignal[] {
  const out: DetectedSignal[] = [];

  // 1. No logins. Unknown last login falls back to store creation so a store
  //    isn't flagged for a column that simply hasn't been populated yet.
  const loginRef = s.ownerLastLoginAt ?? s.storeCreatedAt;
  const quietDays = daysBetween(s.now, loginRef);
  if (quietDays >= CHURN_THRESHOLDS.noLoginDays) {
    out.push({ kind: "NO_LOGIN", subject: "", detail: `No owner login for ${quietDays} days` });
  }

  // 2. No orders. Brand-new stores get the full window before being flagged.
  if (daysBetween(s.now, s.storeCreatedAt) >= CHURN_THRESHOLDS.noOrderDays) {
    if (!s.lastOrderAt) {
      out.push({ kind: "NO_ORDERS", subject: "", detail: "No orders yet" });
    } else {
      const d = daysBetween(s.now, s.lastOrderAt);
      if (d >= CHURN_THRESHOLDS.noOrderDays) {
        out.push({ kind: "NO_ORDERS", subject: "", detail: `No orders for ${d} days` });
      }
    }
  }

  // 3. Failed payment: the plan itself, and each plugin separately.
  if (s.subscriptionPastDueSince) {
    out.push({ kind: "PAYMENT_FAILED", subject: "plan", detail: "Plan renewal payment failed" });
  }
  for (const p of s.paidPlugins) {
    if (p.pastDueSince) {
      out.push({ kind: "PAYMENT_FAILED", subject: `plugin:${p.key}`, detail: `${p.name} renewal payment failed` });
    }
  }

  // 4. Unused paid plugin. There's no per-plugin usage tracking, so "unused"
  //    = installed for N+ days and the store has logged no activity at all
  //    since installing it.
  for (const p of s.paidPlugins) {
    const installedDays = daysBetween(s.now, p.installedAt);
    const touched = s.lastActivityAt && s.lastActivityAt.getTime() > p.installedAt.getTime();
    if (installedDays >= CHURN_THRESHOLDS.unusedPluginDays && !touched) {
      out.push({ kind: "UNUSED_PLUGIN", subject: p.key, detail: `${p.name} installed ${installedDays} days ago, not used` });
    }
  }

  return out;
}

export const signalKey = (kind: string, subject: string) => `${kind}|${subject}`;
