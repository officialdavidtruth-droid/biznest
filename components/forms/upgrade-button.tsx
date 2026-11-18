"use client";

import { useTransition } from "react";
import { initiatePlanUpgrade } from "@/lib/actions/subscription";
import { toast } from "sonner";
import type { BillingPeriod } from "@/lib/billing/period";

export function UpgradeButton({ storeSlug, planId, label, period = "MONTHLY" }: { storeSlug: string; planId: string; label: string; period?: BillingPeriod }) {
  const [isPending, startTransition] = useTransition();

  function upgrade() {
    startTransition(async () => {
      const result = await initiatePlanUpgrade(storeSlug, planId, period);
      if (!result.success) {
        toast.error(result.error);
        return;
      }
      if ("trialStarted" in result.data) {
        toast.success("Your free trial has started!");
        window.location.reload();
        return;
      }
      window.location.href = result.data.authorizationUrl;
    });
  }

  return (
    <button
      onClick={upgrade}
      disabled={isPending}
      className="mt-3 w-full rounded-md border px-3 py-1.5 text-xs font-medium hover:bg-muted disabled:opacity-50"
    >
      {isPending ? "Starting checkout…" : label}
    </button>
  );
}
