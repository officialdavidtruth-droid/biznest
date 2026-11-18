"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { initiatePlanUpgrade } from "@/lib/actions/subscription";
import { formatMoney } from "@/lib/utils/format-money";
import { effectiveMonthlyFor, yearlyPriceFor, yearlySavingsFor, type BillingPeriod } from "@/lib/billing/period";
import { rankedPlans } from "@/lib/plans/plan-comparison";
import { BillingPeriodToggle } from "@/components/forms/billing-period-toggle";

type Plan = {
  id: string;
  name: string;
  price: unknown; // Prisma Decimal, serialized to a plain string/number by Next
  commissionRate?: unknown;
  features: unknown;
};

type Features = { products?: number; services?: number; customDomain?: boolean };

export function PlanPicker({
  slug,
  plans,
  trialPlanId,
  trialDays,
}: {
  slug: string;
  plans: Plan[];
  trialPlanId: string | null;
  trialDays: number;
}) {
  const router = useRouter();
  const [loadingId, setLoadingId] = useState<string | null>(null);
  const [period, setPeriod] = useState<BillingPeriod>("MONTHLY");
  const ranked = useMemo(() => rankedPlans(plans.map((p) => ({ ...p, price: Number(p.price), commissionRate: Number(p.commissionRate ?? 0) }))), [plans]);

  async function choose(planId: string) {
    setLoadingId(planId);
    const result = await initiatePlanUpgrade(slug, planId, period);
    if (result.success) {
      if ("trialStarted" in result.data) {
        toast.success(`Your ${trialDays}-day free trial has started!`);
        router.push(`/${slug}/admin`);
        return;
      }
      window.location.href = result.data.authorizationUrl;
      return;
    }
    setLoadingId(null);
    toast.error(result.error ?? "Couldn't start checkout. Try again.");
  }

  return (
    <div>
      <div className="mb-6">
        <BillingPeriodToggle period={period} onChange={setPeriod} />
      </div>
      <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
        {ranked.map((plan) => {
          const features = (plan.features ?? {}) as Features;
          const isMogul = plan.rank === 3;
          const isTrialPlan = plan.id === trialPlanId;
          const yearly = period === "YEARLY";
          return (
            <div key={plan.id} className={`flex flex-col rounded-xl border p-6 ${isMogul ? "border-primary shadow-sm" : "border-border"}`}>
              {isMogul && (
                <span className="mb-2 w-fit rounded-full bg-primary/10 px-2 py-0.5 text-xs font-medium text-primary">Best value at scale</span>
              )}
              {isTrialPlan && (
                <span className="mb-2 w-fit rounded-full bg-emerald-100 px-2 py-0.5 text-xs font-medium text-emerald-700">{trialDays}-day free trial</span>
              )}
              <h2 className="text-lg font-semibold">{plan.name}</h2>
              <p className="mt-1 text-2xl font-bold">
                {formatMoney(effectiveMonthlyFor(plan.price, period))}
                <span className="text-sm font-normal text-muted-foreground">/month</span>
              </p>
              {yearly ? (
                <p className="mt-1 text-xs text-muted-foreground">
                  Billed {formatMoney(yearlyPriceFor(plan.price))} a year. <span className="font-medium text-emerald-700">You save {formatMoney(yearlySavingsFor(plan.price))}.</span>
                </p>
              ) : (
                <p className="mt-1 text-xs text-muted-foreground">Billed monthly, cancel anytime.</p>
              )}
              {isTrialPlan && (
                <p className="mt-1 text-xs text-emerald-700">Free for {trialDays} days, then {yearly ? `${formatMoney(yearlyPriceFor(plan.price))} a year` : `${formatMoney(plan.price)}/month`}.</p>
              )}
              <ul className="mt-4 flex-1 space-y-2 text-sm text-muted-foreground">
                <li>✓ {plan.commissionRate === 0 ? "No commission on your sales" : `${plan.commissionRate}% commission on sales`}</li>
                <li>✓ {features.products === -1 ? "Unlimited products" : `Up to ${features.products ?? 0} products`}</li>
                <li>✓ {features.services === -1 ? "Unlimited services" : `Up to ${features.services ?? 0} services`}</li>
                <li>{features.customDomain ? "✓ Your own domain name" : "✓ Runs on your biznest.space address"}</li>
                {plan.rank >= 2 && <li>✓ Point of Sale, invoices, quotes and coupons</li>}
                {plan.rank >= 2 && <li>✓ Business apps (PMS, HR, CRM, FnB and more)</li>}
                {plan.rank >= 3 && <li>✓ Abandoned-checkout recovery, automations and report builder</li>}
                {plan.rank >= 3 && <li>✓ Ads, webhooks and up to 20 staff accounts</li>}
              </ul>
              <button
                onClick={() => choose(plan.id)}
                disabled={loadingId !== null}
                className="mt-6 w-full rounded-md bg-primary py-2 text-sm font-medium text-primary-foreground disabled:opacity-60"
              >
                {loadingId === plan.id
                  ? isTrialPlan
                    ? "Starting trial…"
                    : "Redirecting to payment…"
                  : isTrialPlan
                    ? `Start ${trialDays}-day free trial`
                    : `Subscribe to ${plan.name}${yearly ? " yearly" : ""}`}
              </button>
            </div>
          );
        })}
      </div>
    </div>
  );
}
