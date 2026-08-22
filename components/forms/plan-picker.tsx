"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { initiatePlanUpgrade } from "@/lib/actions/subscription";

type Plan = {
  id: string;
  name: string;
  price: unknown; // Prisma Decimal, serialized to a plain string/number by Next
  features: unknown;
};

function fmtNaira(price: unknown) {
  return `₦${Number(price).toLocaleString("en-NG")}`;
}

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

  async function choose(planId: string) {
    setLoadingId(planId);
    const result = await initiatePlanUpgrade(slug, planId);
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
    <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
      {plans.map((plan) => {
        const features = (plan.features ?? {}) as {
          products?: number;
          services?: number;
          customDomain?: boolean;
          aiStoreBuilder?: boolean;
        };
        const isAi = !!features.aiStoreBuilder;
        const isMogul = plan.name === "Business Mogul";
        const isTrialPlan = plan.id === trialPlanId;
        return (
          <div
            key={plan.id}
            className={`flex flex-col rounded-xl border p-6 ${
              isAi ? "border-primary shadow-sm" : "border-border"
            }`}
          >
            {isAi && (
              <span className="mb-2 w-fit rounded-full bg-primary/10 px-2 py-0.5 text-xs font-medium text-primary">
                {isMogul ? "Best value at scale" : "Most popular"}
              </span>
            )}
            {isTrialPlan && (
              <span className="mb-2 w-fit rounded-full bg-emerald-100 px-2 py-0.5 text-xs font-medium text-emerald-700">
                {trialDays}-day free trial
              </span>
            )}
            <h2 className="text-lg font-semibold">{plan.name}</h2>
            <p className="mt-1 text-2xl font-bold">
              {fmtNaira(plan.price)}
              <span className="text-sm font-normal text-muted-foreground">/month</span>
            </p>
            {isTrialPlan && (
              <p className="mt-1 text-xs text-emerald-700">Free for {trialDays} days, then {fmtNaira(plan.price)}/month.</p>
            )}
            <ul className="mt-4 flex-1 space-y-2 text-sm text-muted-foreground">
              {isMogul ? (
                <>
                  <li>✓ Everything in Custom AI-Built Store, plus:</li>
                  <li>✓ Unlimited products &amp; services</li>
                  <li>✓ Lowest commission rate on every sale (1%)</li>
                  <li>✓ Full access to every template tier, including exclusive premium designs</li>
                  <li>✓ Custom domain (yourbrand.com)</li>
                  <li>✓ Priority support</li>
                </>
              ) : isAi ? (
                <>
                  <li>✓ AI Store Builder — describe your business, get a full store instantly</li>
                  <li>✓ Custom homepage, hero copy, about section &amp; FAQ generated for you</li>
                  <li>✓ SEO title &amp; description generated and editable</li>
                  <li>✓ Custom domain (yourbrand.com)</li>
                  <li>✓ Access to mid + premium template tiers</li>
                  <li>✓ Lower commission rate (3%)</li>
                  <li>✓ Up to 3,000 products / 1,500 services</li>
                </>
              ) : (
                <>
                  <li>✓ Choose from our library of ready-made templates</li>
                  <li>✓ WhatsApp order button built in</li>
                  <li>✓ Delivery zones &amp; coupon codes</li>
                  <li>✓ Order &amp; inventory management</li>
                  <li>✓ Storefront analytics</li>
                  <li>✓ Up to 300 products / 150 services</li>
                  <li>— Custom domain (upgrade to unlock)</li>
                </>
              )}
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
                  : `Subscribe to ${plan.name}`}
            </button>
          </div>
        );
      })}
    </div>
  );
}
