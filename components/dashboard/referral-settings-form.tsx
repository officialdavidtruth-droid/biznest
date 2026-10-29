"use client";

import { useState } from "react";
import { toast } from "sonner";
import { updateReferralSettingsAction } from "@/lib/actions/referral";

export function ReferralSettingsForm({
  slug,
  initial,
}: {
  slug: string;
  initial: { enabled: boolean; referrerPoints: number; refereePoints: number; minOrderAmount: number; maxRewardsPerReferrer: number; expiryDays: number };
}) {
  const [enabled, setEnabled] = useState(initial.enabled);
  const [referrerPoints, setReferrerPoints] = useState(String(initial.referrerPoints));
  const [refereePoints, setRefereePoints] = useState(String(initial.refereePoints));
  const [minOrderAmount, setMinOrderAmount] = useState(String(initial.minOrderAmount));
  const [maxRewardsPerReferrer, setMaxRewardsPerReferrer] = useState(String(initial.maxRewardsPerReferrer));
  const [expiryDays, setExpiryDays] = useState(String(initial.expiryDays));
  const [pending, setPending] = useState(false);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setPending(true);
    try {
      const res = await updateReferralSettingsAction(slug, {
        enabled,
        referrerPoints: Number(referrerPoints),
        refereePoints: Number(refereePoints),
        minOrderAmount: Number(minOrderAmount),
        maxRewardsPerReferrer: Number(maxRewardsPerReferrer),
        expiryDays: Number(expiryDays),
      });
      if (!res.success) return void toast.error(res.error);
      toast.success("Referral settings saved.");
    } catch {
      toast.error("Something went wrong. Please try again.");
    } finally {
      setPending(false);
    }
  }

  const field = "w-full rounded-md border px-3 py-1.5 text-sm";
  return (
    <form onSubmit={onSubmit} className="space-y-4 rounded-lg border bg-background p-4">
      <label className="flex items-center gap-2 text-sm font-medium">
        <input type="checkbox" checked={enabled} onChange={(e) => setEnabled(e.target.checked)} />
        Referral program is on
      </label>
      <div className="grid gap-3 sm:grid-cols-2">
        <label className="space-y-1 text-sm">
          <span className="text-muted-foreground">Points for the customer who refers</span>
          <input type="number" min="0" step="1" value={referrerPoints} onChange={(e) => setReferrerPoints(e.target.value)} className={field} />
        </label>
        <label className="space-y-1 text-sm">
          <span className="text-muted-foreground">Points for the new customer</span>
          <input type="number" min="0" step="1" value={refereePoints} onChange={(e) => setRefereePoints(e.target.value)} className={field} />
        </label>
      </div>
      <div className="grid gap-3 sm:grid-cols-3">
        <label className="space-y-1 text-sm">
          <span className="text-muted-foreground">Minimum first-order value</span>
          <input type="number" min="0" step="0.01" value={minOrderAmount} onChange={(e) => setMinOrderAmount(e.target.value)} className={field} />
        </label>
        <label className="space-y-1 text-sm">
          <span className="text-muted-foreground">Max rewards per referrer (0 = no limit)</span>
          <input type="number" min="0" step="1" value={maxRewardsPerReferrer} onChange={(e) => setMaxRewardsPerReferrer(e.target.value)} className={field} />
        </label>
        <label className="space-y-1 text-sm">
          <span className="text-muted-foreground">Expire waiting referrals after (days, 0 = never)</span>
          <input type="number" min="0" step="1" value={expiryDays} onChange={(e) => setExpiryDays(e.target.value)} className={field} />
        </label>
      </div>
      <p className="text-xs text-muted-foreground">
        Points can be cashed out as coupons, so a reward is real money. The new customer must also have verified their email. If you lower the reward later, friends who already signed up still get the amount they were promised. Points are paid into each customer&apos;s store rewards once the new customer&apos;s first order is completed — not when they sign up.
      </p>
      <button disabled={pending} className="rounded-md bg-primary px-3 py-1.5 text-sm font-medium text-primary-foreground disabled:opacity-50">Save</button>
    </form>
  );
}
