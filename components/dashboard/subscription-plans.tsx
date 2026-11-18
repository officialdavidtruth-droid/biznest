"use client";

import { useMemo, useState } from "react";
import { UpgradeButton } from "@/components/forms/upgrade-button";
import { BillingPeriodToggle } from "@/components/forms/billing-period-toggle";
import { formatMoney } from "@/lib/utils/format-money";
import { effectiveMonthlyFor, normalizePeriod, yearlyPriceFor, yearlySavingsFor, type BillingPeriod } from "@/lib/billing/period";
import { rankedPlans } from "@/lib/plans/plan-comparison";

type Plan = { id: string; name: string; price: number; commissionRate: number; features: unknown };
type Features = { products?: number; services?: number; customDomain?: boolean };

const WEEK_MS = 7 * 24 * 60 * 60 * 1000;

/** The plan cards on the dashboard's Subscription page, with the same monthly/yearly switch as checkout. */
export function SubscriptionPlans({
  slug,
  plans,
  currentPlanId,
  currentPeriod,
  renewsAtMs,
  renewsLabel,
}: {
  slug: string;
  plans: Plan[];
  currentPlanId: string | null;
  currentPeriod: string;
  renewsAtMs: number | null;
  renewsLabel: string | null;
}) {
  const ranked = useMemo(() => rankedPlans(plans), [plans]);
  const paying = normalizePeriod(currentPeriod);
  const [period, setPeriod] = useState<BillingPeriod>(paying);

  return (
    <div>
      <div className="mb-5">
        <BillingPeriodToggle period={period} onChange={setPeriod} />
      </div>
      <div className="grid gap-4 sm:grid-cols-3">
        {ranked.map((p) => {
          const features = (p.features ?? {}) as Features;
          const isCurrent = p.id === currentPlanId;
          const yearly = period === "YEARLY";
          const samePeriod = paying === period;
          const dueSoon = renewsAtMs !== null && renewsAtMs <= Date.now() + WEEK_MS;
          return (
            <div key={p.id} className={`rounded-lg border bg-background p-4 ${isCurrent ? "border-primary ring-1 ring-primary" : ""}`}>
              <p className="font-medium">{p.name}</p>
              <p className="mt-1 text-2xl font-semibold">
                {formatMoney(effectiveMonthlyFor(p.price, period))}
                <span className="text-xs font-normal text-muted-foreground">/month</span>
              </p>
              {yearly ? (
                <p className="mt-1 text-xs text-muted-foreground">
                  Billed {formatMoney(yearlyPriceFor(p.price))} a year · <span className="font-medium text-emerald-700">save {formatMoney(yearlySavingsFor(p.price))}</span>
                </p>
              ) : (
                <p className="mt-1 text-xs text-muted-foreground">Billed monthly</p>
              )}
              <ul className="mt-3 space-y-1.5 text-xs text-muted-foreground">
                <li>{p.commissionRate === 0 ? "No commission per sale" : `${p.commissionRate}% commission per sale`}</li>
                <li>{features.products === -1 ? "Unlimited products" : `Up to ${features.products ?? 0} products`}</li>
                <li>{features.services === -1 ? "Unlimited services" : `Up to ${features.services ?? 0} services`}</li>
                <li className={features.customDomain ? "text-foreground" : ""}>{features.customDomain ? "✓ Custom domain" : "No custom domain"}</li>
                {p.rank >= 2 && <li className="text-foreground">✓ POS, invoices, quotes, coupons</li>}
                {p.rank >= 2 && <li className="text-foreground">✓ Business apps</li>}
                {p.rank >= 3 && <li className="text-foreground">✓ Growth tools, ads, webhooks</li>}
              </ul>
              {isCurrent ? (
                <>
                  <span className="mt-3 inline-block rounded-full bg-primary/10 px-2 py-0.5 text-xs font-medium text-primary">
                    Current plan · {paying === "YEARLY" ? "yearly" : "monthly"}
                  </span>
                  {p.price > 0 && renewsLabel && <p className="mt-2 text-xs text-muted-foreground">Active until {renewsLabel}</p>}
                  {samePeriod && p.price > 0 && dueSoon && (
                    <UpgradeButton storeSlug={slug} planId={p.id} period={period} label={yearly ? "Renew for a year" : "Renew plan"} />
                  )}
                  {!samePeriod && p.price > 0 && (
                    <UpgradeButton storeSlug={slug} planId={p.id} period={period} label={yearly ? `Pay yearly (${formatMoney(yearlyPriceFor(p.price))})` : "Switch to monthly"} />
                  )}
                </>
              ) : (
                <UpgradeButton storeSlug={slug} planId={p.id} period={period} label={p.price === 0 ? "Switch to Free" : yearly ? "Upgrade, pay yearly" : "Upgrade"} />
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
