"use client";

import { useState } from "react";
import { toast } from "sonner";
import { updateReferralSettingsAction } from "@/lib/actions/referral";

export function ReferralSettingsForm({
  slug,
  initial,
}: {
  slug: string;
  initial: { enabled: boolean; referrerPoints: number; refereePoints: number };
}) {
  const [enabled, setEnabled] = useState(initial.enabled);
  const [referrerPoints, setReferrerPoints] = useState(String(initial.referrerPoints));
  const [refereePoints, setRefereePoints] = useState(String(initial.refereePoints));
  const [pending, setPending] = useState(false);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setPending(true);
    try {
      const res = await updateReferralSettingsAction(slug, {
        enabled,
        referrerPoints: Number(referrerPoints),
        refereePoints: Number(refereePoints),
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
      <p className="text-xs text-muted-foreground">
        Points are paid into each customer&apos;s store rewards once the new customer&apos;s first order is completed — not when they sign up.
      </p>
      <button disabled={pending} className="rounded-md bg-primary px-3 py-1.5 text-sm font-medium text-primary-foreground disabled:opacity-50">Save</button>
    </form>
  );
}
