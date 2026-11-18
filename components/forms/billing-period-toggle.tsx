"use client";

import { useEffect } from "react";
import { BILLING_PREF_KEY } from "@/lib/billing/preference";
import { YEARLY_DISCOUNT, type BillingPeriod } from "@/lib/billing/period";

/** Monthly / Yearly switch used by the checkout plan picker and the subscription page. */
export function BillingPeriodToggle({ period, onChange }: { period: BillingPeriod; onChange: (next: BillingPeriod) => void }) {
  // Start on whatever the visitor picked on the landing page.
  useEffect(() => {
    try {
      if (localStorage.getItem(BILLING_PREF_KEY) === "YEARLY") onChange("YEARLY");
    } catch { /* storage unavailable: keep the default */ }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function pick(next: BillingPeriod) {
    onChange(next);
    try { localStorage.setItem(BILLING_PREF_KEY, next); } catch { /* ignore */ }
  }

  return (
    <div className="flex flex-wrap items-center justify-center gap-3">
      <div className="inline-flex rounded-full border bg-background p-1" role="group" aria-label="Billing period">
        {(["MONTHLY", "YEARLY"] as const).map((value) => (
          <button
            key={value}
            type="button"
            aria-pressed={period === value}
            onClick={() => pick(value)}
            className={`rounded-full px-4 py-1.5 text-sm font-medium transition ${period === value ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:text-foreground"}`}
          >
            {value === "MONTHLY" ? "Monthly" : "Yearly"}
          </button>
        ))}
      </div>
      <span className="rounded-full bg-emerald-100 px-3 py-1 text-xs font-semibold text-emerald-700">Save {Math.round(YEARLY_DISCOUNT * 100)}% yearly</span>
    </div>
  );
}
